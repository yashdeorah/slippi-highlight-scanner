import test from "node:test";
import assert from "node:assert/strict";
import { elapsed, scoreMoment, validComeback } from "../src/scoring.js";

test("timestamps are elapsed from replay start", () => assert.equal(elapsed(60 * 147), "2:27"));
test("recent replay weighting is soft", () => assert.equal(scoreMoment({type:"combo"}, "2026-08-28") - scoreMoment({type:"combo"}, "2026-08-27"), 18));
test("unforced low-percent stock loss disqualifies comeback", () => assert.equal(validComeback([{endFrame:1000,endPercent:4}], []), false));
test("recent kill conversion validates stock loss", () => assert.equal(validComeback([{endFrame:1000,endPercent:4}], [{playerIndex:0,endFrame:950,didKill:true}]), true));
