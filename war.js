var _ = require('lodash');

var run = {};

run.initialState = function() {
    return {
        history: [
            [],
            []
        ],

        // these other fields aren't strictly necessary because you
        // can calculate them from the history, but they're nice to
        // have
        p: [{ // player
            available_cards: [true, true, true, true, true, true, true, true, true, true, true, true, true],
            score: 0
        }, {
            available_cards: [true, true, true, true, true, true, true, true, true, true, true, true, true],
            score: 0
        }],
        tie_score: 0
    };
};

// Play single game (from its current state, even if that's mid-game)
// to its conclusion.
run.playSingleGame = function(state, strat0, strat1) {
    while (state.history[0].length < 13) {
        var moves = [
            strat0(state, 0, 1),
            strat1(state, 1, 0)
        ];
        state = run.makeMove(state, moves);
    }
    return state;
};

run.makeMove = function(state, moves) {
    if (!state.p[0].available_cards[moves[0]]) throw 0 + " can't play " + moves[0];
    if (!state.p[1].available_cards[moves[1]]) throw 1 + " can't play " + moves[1];

    state.p[0].available_cards[moves[0]] = false;
    state.p[1].available_cards[moves[1]] = false;

    if (moves[0] != moves[1]) {
        if (moves[0] > moves[1]) {
            state.p[0].score++;
            state.p[0].score += state.tie_score;
        } else if (moves[0] < moves[1]) {
            state.p[1].score++;
            state.p[1].score += state.tie_score;
        }
        state.tie_score = 0;
    } else {
        state.tie_score++;
    }

    state.history[0].push(moves[0]);
    state.history[1].push(moves[1]);

    return state;
};

run.runTrials = function(strat0, strat1, trials) {
    var score = [0, 0];
    var tie = 0;

    var state;
    for (var i = 0; i < trials; ++i) {
        // console.log("running trial " + i);
        state = run.playSingleGame(run.initialState(), strat0, strat1);
        if (state.p[0].score > state.p[1].score) {
            score[0] ++;
        } else if (state.p[0].score < state.p[1].score) {
            score[1] ++;
        } else {
            tie++;
        }
    }

    console.log();
    console.log("### Sample Round ###");
    u.prettyPrintState(state);
    console.log();

    if (score[0] > score[1]) {
        console.log("\"" + strat0.desc + "\" won " + score[0] + " to " + score[1] + ", " + tie + " ties.");
    } else if (score[1] > score[0]) {
        console.log("\"" + strat1.desc + "\" won " + score[1] + " to " + score[0] + ", with " + tie + " ties.");
    } else {
        console.log("Tie of " + score[0] + " to " + score[1] + " with " + tie + " ties.");
    }
};

// all strategies pinky-swear to not modify the state
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
strategy.random.desc = "random";

strategy.up = function(state, me, them) {
    return state.history[0].length;
};
strategy.up.desc = "up";

strategy.down = function(state, me, them) {
    return 12 - state.history[0].length;
};
strategy.down.desc = "down";

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
strategy.upOnWin.desc = "up on win";

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
strategy.downOnWin.desc = "down on win";

strategy.highestOnTie = function(state, me, them) {
    if (u.tiedLast(state.history)) {
        return u.highest(state.p[me].available_cards);
    }
    return strategy.random(state, me, them);
};
strategy.highestOnTie.desc = "highest on tie";

strategy.winAllTies = function(state, me, them) {
    var avail = state.p[me].available_cards;
    if (u.tiedLast(state.history)) {
        return u.highest(avail);
    }
    return u.lowest(avail);
};
strategy.winAllTies.desc = "win all ties";

strategy.monteCarlo = function(times, otherStrat) {
    var mc = function(state, me, them) {
        var winningCard;
        var winningScore;
        var debugScores = [];

        for (var card = 0; card < 13; ++card) {
            if (state.p[me].available_cards[card]) {

                var cardScore = 0;
                for (var t = 0; t < times; ++t) {
                    // console.log("trial: " + t + ", card: " + card);

                    var s = _.cloneDeep(state);
                    if (me === 0) {
                        s = run.makeMove(s, [card, otherStrat(s, them, me)]);
                    } else {
                        s = run.makeMove(s, [otherStrat(s, them, me), card]);
                    }
                    s = run.playSingleGame(s, otherStrat, otherStrat);

                    if (s.p[me].score > s.p[them].score) ++cardScore;
                }

                if (!winningScore || winningScore < cardScore) {
                    winningScore = cardScore;
                    winningCard = card;
                }

                debugScores.push(cardScore);
            } else {
                debugScores.push(-1);
            }
        }

        // console.log("scores: " + debugScores);
        return winningCard;
    };
    mc.desc = "monte carlo with " + times + " trials and strategy " + otherStrat.desc;
    return mc;
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
    return history[me].length > 0 && u.last(history[me]) > u.last(history[u.otherPlayer(me)]);
};

u.lostLast = function(history, me) {
    return history[me].length > 0 && u.last(history[me]) < u.last(history[u.otherPlayer(me)]);
};

u.tiedLast = function(history) {
    return history[0].length > 0 && !u.wonLast(history, 0) && !u.lostLast(history, 0);
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
    throw "impossible: no highest";
};

u.lowest = function(arr) {
    for (var i = 0; i < arr.length; ++i) {
        if (arr[i]) return i;
    }
    throw "impossible: no lowest";
};

u.prettyPrintState = function(state) {
    var s = _.cloneDeep(state);
    s.p[0].available_cards = u.prettyBoolArray(s.p[0].available_cards);
    s.p[1].available_cards = u.prettyBoolArray(s.p[1].available_cards);
    s.history[0] = u.prettyHistory(s.history[0]);
    s.history[1] = u.prettyHistory(s.history[1]);
    console.log(s);
};

u.prettyHistory = function(hist) {
    var r = "";
    for (var i = 0; i < hist.length; ++i) {
        if (hist[i] >= 10) {
            r += " " + hist[i] + " ";
        } else {
            r += "  " + hist[i] + " ";
        }
    }
    return r;
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
    run.runTrials(
        strategy.random,
        // strategy.up,           /// wins 48%
        // strategy.down,         /// wins 48%
        // strategy.upOnWin,      /// wins 48%
        // strategy.downOnWin,    /// wins 48%
        // strategy.highestOnTie, /// wins 59%
        strategy.winAllTies, /// wins 64% consistently
        // strategy.monteCarlo(100, strategy.random), // wins about 60%, slowly
        // strategy.monteCarlo(100, strategy.highestOnTie), // wins mid-60% against random
        100000);
}

main();
test.main();