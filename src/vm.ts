import {LuaFactory, LuaEngine, LuaEventMasks, LuaTimeoutError, LuaReturn, LuaThread } from "../deps.ts";

export enum ThreadState {
    Idle = 0,
    Running = 1,
    ForceYield = 2,
    ForceTerminate = 3,
    Yield = 4,
    Completed = 6,
    Error = 7
}

class TestAPI {
    public test1() {
        console.log("Test API 1 called!");
    }

    private test2() {
        console.log("Test API 2 called!");
    }

    public async test3() {
        await new Promise(resolve => setTimeout(resolve, 4000));
        console.log("Test API 3 called!");
    }

    public test4() {
        console.log("Test API 4 called!");

    }

}

export class LuaThreadWrapper {
    private readonly sandbox: LuaSandbox;
    private readonly code: string;
    private readonly name: string;
    private readonly L: LuaThread;
    private instructions = 0;
    private runCount = 0;
    private results?: any;
    private state: ThreadState = ThreadState.Idle;
    private index: number;

    constructor(sandbox: LuaSandbox, code: string, name: string, L: LuaThread, index: number, options?: any) {
        this.sandbox = sandbox;
        this.code = code;
        this.name = name;
        this.L = L;
        this.index = index;
        // This can fail so wrap construction in a try/catch.
        this.L.loadString(this.code, this.name);
        this.initEnvironment();
        this.initApi();
        this.setSafety();
    }

    public getIndex() {
        return this.index;
    }

    public set(name: string, value: any) {
        this.L.pushValue(value);
        this.L.lua.lua_setglobal(this.L.address, name);
    }

    public isClosed() {
        return this.L.isClosed();
    }

    public getState() {
        return this.state;
    }

    public getResults() {
        return this.results;
    }

    public getRunCount() {
        return this.runCount;
    }

    protected initEnvironment() {

    }

    protected initApi() {
        this.set("api", new TestAPI());
    }

    protected setSafety() {
        const instance = this;
        const hook = this.makeFunction((): void => {
            // not certain if 'this' will capture properly, I might have to 'break the rules' and use the const instance
            // deno complains about if it doesn't.
            instance.checkSandbox();
        }, "vii");

        // set the hook to run every 1000 instructions
        this.setHook(hook, 1000);
    }

    public setHook(hook: any, count: number) {
        this.L.lua.lua_sethook(this.L.address, hook, LuaEventMasks.Count, count);
    }

    protected makeFunction(f: any, signature: string) {
        return this.L.lua.module.addFunction(f, signature);
    }

    protected checkSandbox() {
        this.instructions += 1000;
        if (this.instructions > 4000) {
            // error out?
            console.log("Sandbox exceeded instruction limit");
            this.state = ThreadState.ForceTerminate;
            this.L.pushValue(new LuaTimeoutError("Sandbox exceeded instruction limit"));
            this.L.lua.lua_error(this.L.address);
        } else {
            // Attempt a yield?
            this.state = ThreadState.ForceYield;
            console.log(`Sandbox forcibly yielded at ${this.instructions} instructions.`);
            this.L.lua.lua_yield(this.L.address, 0);
        }
    }

    protected async execute() {
        this.state = ThreadState.Running;

        while(this.state === ThreadState.Running) {
            let output = this.L.resume(0);

            switch(output.result) {
                case LuaReturn.Ok:
                    this.state = ThreadState.Completed;
                    this.results = output.resultCount ? this.L.getStackValues() : undefined;
                    break;
                case LuaReturn.Yield:
                {
                    if(output.resultCount > 0) {
                        this.results = this.L.getStackValues();
                        const lastValue = this.results[0];
                        this.L.pop(output.resultCount)

                        // If there's a result and it's a promise, then wait for it.
                        // This should only happen because a Promise ended up in JS due to API code.
                        // These are probably things like database checks and other program state queries.
                        if (lastValue === Promise.resolve(lastValue)) {
                            // remove [0] from this.results...
                            this.results.shift();
                            await lastValue
                        } else {
                            // If it's a non-promise, then we're done for now.
                            this.state = ThreadState.Yield;
                        }
                    }
                }
                break;
                default:
                    // it's an error...
                    if(this.state === ThreadState.ForceTerminate) {
                        this.results = undefined;
                    } else {
                        this.state = ThreadState.Error;
                        this.results = this.L.getStackValues();
                    }
            }
        }
    }

    protected async runWrapper() {
        this.runCount++;
        await this.execute();
        switch(this.state) {
            case ThreadState.Completed:
            case ThreadState.Error:
            case ThreadState.ForceTerminate:
                this.L.close();
                break;
        }
    }

    public async run() {
        await this.runWrapper();
        return this.results;
    }

    public close() {
        if(!this.isClosed()) this.L.close();
        this.sandbox.deleteThread(this.name);
    }

}

export class LuaSandbox {
    private readonly L: LuaEngine;
    private readonly threads: Map<string, LuaThreadWrapper> = new Map<string, LuaThreadWrapper>();

    static wrapperClass = LuaThreadWrapper;

    constructor(L: LuaEngine) {
        this.L = L;
    }

    public loadCode(code: string, name: string, options?: any): LuaThreadWrapper {
        const LT = this.L.global.newThread();
        const idx = this.L.global.getTop();
        try {
            const wrapper = new (this.constructor as typeof LuaSandbox).wrapperClass(this, code, name, LT, idx, options);
            this.threads.set(name, wrapper);
        }
        catch(err) {
            this.L.global.remove(idx);
            throw err;
        }
        return this.threads.get(name)!;
    }

    public deleteThread(name: string) {
        // first retrieve a reference...
        const wrapper = this.threads.get(name);
        if(!wrapper) return;
        this.threads.delete(name);
        wrapper.close();
    }

    public getThread(name: string) {
        return this.threads.get(name);
    }

    public getThreads() {
        return this.threads;
    }

}