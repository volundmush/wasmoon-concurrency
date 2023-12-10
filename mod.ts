import {LuaSandbox} from "./src/vm.ts";
import {LuaFactory} from "./deps.ts";


async function main() {
    const factory = new LuaFactory();
    const L = await factory.createEngine();
    const vm = new LuaSandbox(L);

    for (const path of ["test1", "test2", "test3"]) {
        const code = await Deno.readTextFile(`./lua/${path}.lua`);
        console.log(`Initializing ${path}.lua`);

        let thread = vm.loadCode(code, path);


        while(!thread.isClosed()) {
            console.log(`Running ${path}.lua: ${thread.getRunCount()} times`);
            const results = await thread.run();
            console.log(`Results: ${results}`)

            // stagger runs...
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

    }

}

if (import.meta.main) await main();