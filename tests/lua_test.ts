import {
    assertEquals,
    assertNotEquals,
    assertExists
    // ... other necessary assertions
} from "https://deno.land/std/testing/asserts.ts";

import {LuaSandbox, LuaThreadWrapper, LuaFactory} from "../mod.ts";

const factory = new LuaFactory();
const L = await factory.createEngine();
const vm = new LuaSandbox(L);

async function runCode(path: string) {

    const code = await Deno.readTextFile(`./tests/lua/${path}.lua`);
    let thread = vm.loadCode(code, path);
    let results = undefined;
    while(!thread.isClosed()) {
        results = await thread.run();

        // stagger runs...
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return results;
}

Deno.test("Lua VM can run test1.lua", async () => {
    const results = await runCode("test1");
    assertExists(results);
    assertEquals(results.length, 1);
    assertEquals(results[0], "boo");
});

Deno.test("Lua VM can run test2.lua", async () => {
    const results = await runCode("test2");

});

Deno.test("Lua VM can run test3.lua", async () => {
    const results = await runCode("test3");
    assertExists(results);
    assertEquals(results.length, 1);
    assertEquals(results[0], "This is a test.");
});