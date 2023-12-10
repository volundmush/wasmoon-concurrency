-- Define a controlled environment
local sandbox_env = {
    -- Include only safe and necessary standard libraries or functions
    print = print,
    pairs = pairs,
    -- ... other safe functions and tables...
}

-- Function to run a user script
function createSandbox(script)

    -- Load the user script
    local func, err = load(script, "user_code", "t", sandbox_env)
    if not func then
        error(err)
    end

    -- Return the function to run the script
    return func

    -- Set a hook to limit execution (assuming sethook functionality is available)
    debug.sethook(function()
        error("Script execution limit reached")
    end, "", 10000) -- Limit to 10000 instructions, adjust as needed

    -- Run the script
    local status, result = pcall(func)
    if not status then
        print("Error in script:", result)
    end

    -- Remove the hook after execution
    debug.sethook()
end

-- Assume 'user_code' contains the Lua code to run
runUserScript(user_code)