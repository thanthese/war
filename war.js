var _ = require('lodash');

var run = {};

run.initialState = function() {
    return {
        history: [
            [],
            []
        ],
        p: [{
            available_cards: [true, true, true, true, true, true, true, true, true, true, true, true, true],
            score: 0
        }, {
            available_cards: [true, true, true, true, true, true, true, true, true, true, true, true, true],
            score: 0
        }],
        tie_score: 0
    };
};

run.hand = function(state, p0, p1, choice0, choice1) {

    var firstTime = true; // only use choice first time

    while (state.history[0].length < 13) {
        var c = [
            firstTime && choice0 !== undefined ? choice0 : p0(state, 0, 1),
            firstTime && choice1 !== undefined ? choice1 : p1(state, 1, 0)
        ];

        firstTime = false;

        if (!state.p[0].available_cards[c[0]]) throw 0 + " can't play " + c[0];
        if (!state.p[1].available_cards[c[1]]) throw 1 + " can't play " + c[1];

        state.p[0].available_cards[c[0]] = false;
        state.p[1].available_cards[c[1]] = false;

        if (c[0] != c[1]) {
            if (c[0] > c[1]) {
                state.p[0].score++;
                state.p[0].score += state.tie_score;
            } else if (c[0] < c[1]) {
                state.p[1].score++;
                state.p[1].score += state.tie_score;
            }
            state.tie_score = 0;
        } else {
            state.tie_score++;
        }

        state.history[0].push(c[0]);
        state.history[1].push(c[1]);
    }

    return state;
};

run.runner = function(s0, name0, s1, name1, trials) {

    var score = [0, 0];
    var tie = 0;

    var hand;
    for (var i = 0; i < trials; ++i) {
        hand = run.hand(run.initialState(), s0, s1);
        if (hand.p[0].score > hand.p[1].score) {
            score[0] ++;
        } else if (hand.p[0].score < hand.p[1].score) {
            score[1] ++;
        } else {
            tie++;
        }
    }
    console.log();
    console.log("### Sample Round ###");
    u.prettyPrintState(hand);
    console.log();

    if (score[0] > score[1]) {
        console.log("\"" + name0 + "\" won " + score[0] + " to " + score[1] + ", " + tie + " ties.");
    } else if (score[1] > score[0]) {
        console.log("\"" + name1 + "\" won " + score[1] + " to " + score[0] + ", with " + tie + " ties.");
    } else {
        console.log("Tie of " + score[0] + " to " + score[1] + " with " + tie + " ties.");
    }
};

var strategy = {};

strategy.random = function(state, me, them) {
    var max_attempts = 1000;
    for (var i = 0; i < max_attempts; ++i) {
        var r = u.randCardIndex();
        if (state.p[me].available_cards[r]) {
            return r;
        }
    }
    throw "Couldn't find available card in " + max_attempts + " attempts.";
};

strategy.up = function(state, me, them) {
    return state.history[0].length;
};

strategy.down = function(state, me, them) {
    return 12 - state.history[0].length;
};

strategy.upOnWin = function(state, me, them) {
    if (state.history[me].length === 0) {
        return strategy.random(state, me, them);
    }

    var avail = state.p[me].available_cards;
    var last = u.last(state.history[me]);
    if (u.wonLast(state.history, me)) {
        var nh = u.nextHighest(avail, last);
        if (nh == -1) return u.highest(avail);
        return nh;
    } else if (u.lostLast(state.history, me)) {
        var nl = u.nextLowest(avail, last);
        if (nl == -1) return u.lowest(avail);
        return nl;
    } else {
        return strategy.random(state, me, them);
    }
};

strategy.downOnWin = function(state, me, them) {
    if (state.history[me].length === 0) {
        return strategy.random(state, me, them);
    }

    var avail = state.p[me].available_cards;
    var last = u.last(state.history[me]);
    if (u.lostLast(state.history, me)) {
        var nh = u.nextHighest(avail, last);
        if (nh == -1) return u.highest(avail);
        return nh;
    } else if (u.wonLast(state.history, me)) {
        var nl = u.nextLowest(avail, last);
        if (nl == -1) return u.lowest(avail);
        return nl;
    } else {
        return strategy.random(state, me, them);
    }
};

strategy.highestOnTie = function(state, me, them) {
    if (state.history[me].length === 0) {
        return strategy.random(state, me, them);
    }

    if (!u.wonLast(state.history, me) && !u.lostLast(state.history, me)) {
        return u.highest(state.p[me].available_cards);
    }

    return strategy.random(state, me, them);
};

strategy.monteCarlo = function(state, me, them) {

    var TIMES = 1000;
    var winningIndex;
    var winningScore;

    var output = [];

    for (var i = 0; i < 13; ++i) {
        if (state.p[me].available_cards[i]) {

            var score = 0;
            for (var t = 0; t < TIMES; ++t) {

                var s = _.cloneDeep(state);
                var r;
                if (me === 0) {
                    r = run.hand(s, strategy.random, strategy.random, i, undefined);
                } else {
                    r = run.hand(s, strategy.random, strategy.random, undefined, i);
                }
                if (s.p[me].score > s.p[them].score) ++score;
            }
            output.push(score);
            if (!winningScore || winningScore < score) {
                winningScore = score;
                winningIndex = i;
            }
        }
    }
    //console.log("scores: " + output);
    return winningIndex;
};

var u = {}; // utilities

u.randInt = function(min, max) {
    // doesn't quite have an even distribution
    return Math.floor(Math.random() * (max - min)) + min;
};

u.randCardIndex = function(min, max) {
    return u.randInt(0, 13);
};

u.last = function(arr) {
    return arr[arr.length - 1];
};

u.wonLast = function(history, me) {
    return u.last(history[me]) > u.last(history[u.otherPlayer(me)]);
};

u.lostLast = function(history, me) {
    return u.last(history[me]) < u.last(history[u.otherPlayer(me)]);
};

u.otherPlayer = function(playerId) {
    return playerId === 0 ? 1 : 0;
};

u.nextHighest = function(arr, n) {
    for (var i = n + 1; i < arr.length; ++i) {
        if (arr[i]) return i;
    }
    return -1;
};

u.nextLowest = function(arr, n) {
    for (var i = n - 1; i >= 0; --i) {
        if (arr[i]) return i;
    }
    return -1;
};

u.highest = function(arr) {
    for (var i = arr.length; i >= 0; --i) {
        if (arr[i]) return i;
    }
    return -1; // impossible
};

u.lowest = function(arr) {
    for (var i = 0; i < arr.length; ++i) {
        if (arr[i]) return i;
    }
    return -1; // impossible
};

u.prettyPrintState = function(state) {
    var s = _.cloneDeep(state);
    s.p[0].available_cards = u.prettyBoolArray(s.p[0].available_cards);
    s.p[1].available_cards = u.prettyBoolArray(s.p[1].available_cards);
    console.log(s);
};

u.prettyBoolArray = function(arr) {
    var r = "";
    for (var i = 0; i < arr.length; ++i) {
        r += arr[i] ? 1 : 0;
    }
    return r;
};

var test = {};

test.main = function() {
    console.log();
    console.log("### Testing ###");

    var e = function(s) {
        console.log("*** ERROR: " + s);
    };

    for (var i = 0; i < 1000; ++i) {
        if (u.randCardIndex() < 0) e("randCardIndex shouldn't be below 0");
        if (u.randCardIndex() > 12) e("randCardIndex shouldn't be about 12");
    }

    if (u.last([1, 2, 3, 4]) != 4) e("last ain't right");

    var p0_won_last = [
        [0, 10],
        [0, 2]
    ];
    var p1_won_last = [
        [0, 2],
        [0, 10]
    ];
    if (!u.wonLast(p0_won_last, 0)) e("wonLast is wrong for player 0");
    if (u.wonLast(p0_won_last, 1)) e("wonLast is wrong for player 0");
    if (!u.wonLast(p1_won_last, 1)) e("wonLast is wrong for player 1");
    if (u.wonLast(p1_won_last, 0)) e("wonLast is wrong for player 1");

    if (u.otherPlayer(1) !== 0) e("otherPlayer is wrong for 1");
    if (u.otherPlayer(0) !== 1) e("otherPlayer is wrong for 0");

    var nha = [true /*0*/ , false /*1*/ , false /*2*/ , true /*3*/ , true /*4*/ , false /*5*/ ];
    if (u.nextHighest(nha, 3) !== 4) e("nextHighest, pos 3");
    if (u.nextHighest(nha, 0) !== 3) e("nextHighest, pos 0");
    if (u.nextHighest(nha, 4) !== -1) e("nextHighest, pos 4");

    if (u.nextLowest(nha, 3) !== 0) e("nextLowest, pos 3");
    if (u.nextLowest(nha, 5) !== 4) e("nextLowest, pos 3");
    if (u.nextLowest(nha, 0) !== -1) e("nextLowest, pos 3");

    var t = true;
    var f = false;
    if (u.highest([t, f, f, t]) !== 3) e("highest, top");
    if (u.highest([t, f, f, f]) !== 0) e("highest, bottom");
    if (u.lowest([t, f, f, t]) !== 0) e("lowest, bottom");
    if (u.lowest([f, f, f, t]) !== 3) e("lowest, top");

    console.log("Done testing.");
};

function main() {
    run.runner(
        strategy.random, "random 1",
        // strategy.up, "up",
        // strategy.down, "down",
        // strategy.upOnWin, "up on win",
        // strategy.downOnWin, "down on win",
        // strategy.highestOnTie, "highest on tie",
        strategy.monteCarlo, "monte carlo",
        1000);
}

main();
test.main();