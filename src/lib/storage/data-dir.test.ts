/**
 * Phase 48 (TFP-277, Decision 6): the data folder's one-time move from its 0.2.x name (TestForge, testforge) to
 * Mr Onion's (MrOnion, mr-onion). Every folder these tests touch is under a fresh temporary folder: none of them
 * resolves the real %LOCALAPPDATA%, ~/Library or ~/.local/share.
 *
 * ISTQB techniques: decision table of which folders exist (neither, old only, new only, both) crossed with whether
 * the rename works, each with its folder and notice; equivalence partitioning of where the folder comes from (a
 * setting under either name, the platform default) and of the platform (Windows, macOS, elsewhere); and real
 * renames on this machine's disk.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/storage/data-dir.test.ts
 */
import assert from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { dataDir, defaultDataDirs, movedOnce, underCurrentName } from "./data-dir.ts";

const scratch = mkdtempSync(join(tmpdir(), "mr-onion-data-dir-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
let next = 0;
/** A fresh parent folder for one case, so no two cases share a folder pair (each pair is settled once per process). */
const parent = () => {
    const dir = join(scratch, String((next += 1)));
    mkdirSync(dir);
    return dir;
};

/** Folders in memory: which exist, every rename asked for, every notice. */
function fakeFolders(existing: string[], rename: (from: string, to: string) => void = () => {}) {
    const folders = new Set(existing);
    const renames: string[][] = [];
    const notices: string[] = [];
    return {
        renames,
        notices,
        ops: {
            exists: (path: string) => folders.has(path),
            rename: (from: string, to: string) => {
                renames.push([from, to]);
                rename(from, to);
                folders.delete(from);
                folders.add(to);
            },
            notice: (text: string) => notices.push(text),
        },
    };
}

test("the default folders under each name: Windows and macOS MrOnion (was TestForge), elsewhere mr-onion (was testforge)", () => {
    const home = join(scratch, "home");
    assert.deepEqual(defaultDataDirs({ LOCALAPPDATA: join(scratch, "local") }, "win32", home), { current: join(scratch, "local", "MrOnion"), old: join(scratch, "local", "TestForge") });
    assert.deepEqual(defaultDataDirs({}, "win32", home), { current: join(home, "AppData", "Local", "MrOnion"), old: join(home, "AppData", "Local", "TestForge") });
    assert.deepEqual(defaultDataDirs({}, "darwin", home), { current: join(home, "Library", "Application Support", "MrOnion"), old: join(home, "Library", "Application Support", "TestForge") });
    assert.deepEqual(defaultDataDirs({ XDG_DATA_HOME: join(scratch, "xdg") }, "linux", home), { current: join(scratch, "xdg", "mr-onion"), old: join(scratch, "xdg", "testforge") });
    assert.deepEqual(defaultDataDirs({}, "linux", home), { current: join(home, ".local", "share", "mr-onion"), old: join(home, ".local", "share", "testforge") });
});

test("only the old folder: renamed to the new one, with one notice saying where it went", () => {
    const dirs = { current: join(scratch, "a", "MrOnion"), old: join(scratch, "a", "TestForge") };
    const fake = fakeFolders([dirs.old]);
    assert.equal(movedOnce(dirs, fake.ops), dirs.current);
    assert.deepEqual(fake.renames, [[dirs.old, dirs.current]]);
    assert.deepEqual(fake.notices, [`Mr Onion's data folder moved from ${dirs.old} to ${dirs.current}.`]);
});

test("both folders: the new one, nothing moved or merged, and the notice names the old one as left in place", () => {
    const dirs = { current: join(scratch, "b", "MrOnion"), old: join(scratch, "b", "TestForge") };
    const fake = fakeFolders([dirs.old, dirs.current]);
    assert.equal(movedOnce(dirs, fake.ops), dirs.current);
    assert.deepEqual(fake.renames, []);
    assert.deepEqual(fake.notices, [`Mr Onion's data folder is ${dirs.current}. The old folder ${dirs.old} is left in place; nothing in it was moved or merged.`]);
});

test("only the new folder, or neither: the new one, with no notice", () => {
    for (const [name, existing] of [["c", true], ["d", false]] as const) {
        const dirs = { current: join(scratch, name, "MrOnion"), old: join(scratch, name, "TestForge") };
        const fake = fakeFolders(existing ? [dirs.current] : []);
        assert.equal(movedOnce(dirs, fake.ops), dirs.current);
        assert.deepEqual([fake.renames, fake.notices], [[], []]);
    }
});

test("the rename fails: the old folder for this process, with the reason, and no second try until the process ends", () => {
    const dirs = { current: join(scratch, "e", "MrOnion"), old: join(scratch, "e", "TestForge") };
    const fake = fakeFolders([dirs.old], () => {
        throw new Error("EBUSY: resource busy or locked");
    });
    assert.equal(movedOnce(dirs, fake.ops), dirs.old);
    assert.equal(movedOnce(dirs, fake.ops), dirs.old);
    assert.equal(fake.renames.length, 1);
    assert.deepEqual(fake.notices, [`Mr Onion couldn't move its data folder from ${dirs.old} to ${dirs.current} (EBUSY: resource busy or locked); using ${dirs.old} for now. The next start tries again.`]);
});

test("the rename fails because another process moved it first: the new one, with no failure notice", () => {
    const dirs = { current: join(scratch, "f", "MrOnion"), old: join(scratch, "f", "TestForge") };
    const folders = new Set([dirs.old]);
    const notices: string[] = [];
    const ops = {
        exists: (path: string) => folders.has(path),
        rename: () => {
            folders.delete(dirs.old);
            folders.add(dirs.current);
            throw new Error("ENOENT: no such file or directory");
        },
        notice: (text: string) => notices.push(text),
    };
    assert.equal(movedOnce(dirs, ops), dirs.current);
    assert.deepEqual(notices, []);
});

test("a process left on the old folder follows it once another process has moved it, rather than recreating it empty", () => {
    const dirs = { current: join(scratch, "h", "MrOnion"), old: join(scratch, "h", "TestForge") };
    const fake = fakeFolders([dirs.old], () => {
        throw new Error("EPERM: operation not permitted");
    });
    assert.equal(movedOnce(dirs, fake.ops), dirs.old);
    // Another process (a later CLI run) moves it.
    const moved = { ...fake.ops, exists: (path: string) => path === dirs.current };
    assert.equal(movedOnce(dirs, moved), dirs.current);
    assert.equal(movedOnce(dirs, moved), dirs.current);
    assert.equal(fake.renames.length, 1);
});

test("underCurrentName: a path under the old default folder, under the new one; anything else, or a user-set folder, null", () => {
    const local = join(scratch, "names");
    const env = { LOCALAPPDATA: local };
    assert.equal(underCurrentName(join(local, "TestForge", "site-suites", "s", "u"), env, "win32", "/nobody"), join(local, "MrOnion", "site-suites", "s", "u"));
    assert.equal(underCurrentName(join(local, "MrOnion", "site-suites", "s"), env, "win32", "/nobody"), null);
    assert.equal(underCurrentName(join(local, "TestForge"), env, "win32", "/nobody"), null);
    assert.equal(underCurrentName(join(local, "TestForgeOther", "x"), env, "win32", "/nobody"), null);
    assert.equal(underCurrentName(join(local, "TestForge", "x"), { ...env, MRONION_DATA_DIR: join(local, "own") }, "win32", "/nobody"), null);
    assert.equal(underCurrentName(join(scratch, "xdg", "testforge", "site-suites"), { XDG_DATA_HOME: join(scratch, "xdg") }, "linux", "/nobody"), join(scratch, "xdg", "mr-onion", "site-suites"));
});

test("a generation record made before the move still finds its site suite: the store's folder, under its new name", async (t) => {
    t.mock.method(console, "warn", () => {});
    // This process's own environment, pointed at temporary folders only (whichever the platform reads), then restored.
    const names = ["MRONION_DATA_DIR", "TESTFORGE_DATA_DIR", "LOCALAPPDATA", "XDG_DATA_HOME", "HOME", "USERPROFILE"];
    const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    t.after(() => {
        for (const name of names) {
            if (saved[name] === undefined) delete process.env[name];
            else process.env[name] = saved[name];
        }
    });
    const home = parent();
    delete process.env.MRONION_DATA_DIR;
    delete process.env.TESTFORGE_DATA_DIR;
    Object.assign(process.env, { LOCALAPPDATA: home, XDG_DATA_HOME: home, HOME: home, USERPROFILE: home });
    const { current, old } = defaultDataDirs(process.env, process.platform, home);
    assert.ok(current.startsWith(scratch) && old.startsWith(scratch), "the default folders are under this file's temporary folder");
    const suite = join("site-suites", "http_localhost_4200", "standard-fast-0123456789");
    mkdirSync(join(old, suite), { recursive: true });
    const { siteSuiteDirFromStore } = await import("../site-suites/store.ts");
    assert.equal(siteSuiteDirFromStore(join(old, suite)), join(current, suite));
    assert.equal(siteSuiteDirFromStore(join(current, suite)), join(current, suite));
    assert.equal(siteSuiteDirFromStore(join(home, "elsewhere", "site-suites", "x")), null);
});

test("settled once per process: a second resolve of the same pair neither renames nor notices again", () => {
    const dirs = { current: join(scratch, "g", "MrOnion"), old: join(scratch, "g", "TestForge") };
    const fake = fakeFolders([dirs.old]);
    movedOnce(dirs, fake.ops);
    movedOnce(dirs, fake.ops);
    assert.deepEqual([fake.renames.length, fake.notices.length], [1, 1]);
});

// The rest use the real disk, under this file's temporary folder.
function oldFolder(at: string) {
    mkdirSync(join(at, "site-suites", "http_localhost_4200", "suite-1"), { recursive: true });
    writeFileSync(join(at, "site-suites", "http_localhost_4200", "suite-1", "suite.json"), '{"saved":"0.2.0"}');
    mkdirSync(join(at, "candidates"), { recursive: true });
    writeFileSync(join(at, "candidates", "pool.json"), '{"candidates":[]}');
}

test("on this disk, Windows' layout: %LOCALAPPDATA%\\TestForge becomes MrOnion with its files, and the old folder is gone", (t) => {
    t.mock.method(console, "warn", () => {});
    const local = parent();
    oldFolder(join(local, "TestForge"));
    assert.equal(dataDir({ LOCALAPPDATA: local }, "win32", join(scratch, "nobody")), join(local, "MrOnion"));
    assert.equal(readFileSync(join(local, "MrOnion", "site-suites", "http_localhost_4200", "suite-1", "suite.json"), "utf8"), '{"saved":"0.2.0"}');
    assert.ok(existsSync(join(local, "MrOnion", "candidates", "pool.json")));
    assert.equal(existsSync(join(local, "TestForge")), false);
});

test("on this disk, the XDG layout: $XDG_DATA_HOME/testforge becomes mr-onion with its files", (t) => {
    t.mock.method(console, "warn", () => {});
    const xdg = parent();
    oldFolder(join(xdg, "testforge"));
    assert.equal(dataDir({ XDG_DATA_HOME: xdg }, "linux", join(scratch, "nobody")), join(xdg, "mr-onion"));
    assert.ok(existsSync(join(xdg, "mr-onion", "site-suites", "http_localhost_4200", "suite-1", "suite.json")));
    assert.equal(existsSync(join(xdg, "testforge")), false);
});

test("a folder the user set, under either name, is used where it is, and the default folder is not moved", (t) => {
    t.mock.method(console, "warn", () => {});
    for (const name of ["MRONION_DATA_DIR", "TESTFORGE_DATA_DIR"]) {
        const local = parent();
        oldFolder(join(local, "TestForge"));
        const own = join(local, "own");
        assert.equal(dataDir({ LOCALAPPDATA: local, [name]: own }, "win32", join(scratch, "nobody")), own);
        assert.ok(existsSync(join(local, "TestForge", "candidates", "pool.json")), name);
        assert.equal(existsSync(join(local, "MrOnion")), false, name);
    }
    // A user-set folder that is the old default itself stays where it is too.
    const local = parent();
    oldFolder(join(local, "TestForge"));
    assert.equal(dataDir({ LOCALAPPDATA: local, MRONION_DATA_DIR: join(local, "TestForge") }, "win32", join(scratch, "nobody")), join(local, "TestForge"));
    assert.equal(existsSync(join(local, "MrOnion")), false);
});
