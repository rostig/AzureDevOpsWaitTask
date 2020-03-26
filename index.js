//https://github.com/microsoft/azure-pipelines-task-lib/blob/master/node/docs/azure-pipelines-task-lib.md#taskgetInput
console.log("Starting waiting script");

const tl = require("azure-pipelines-task-lib/task");
const request = require('request-promise-native');
const moment = require('moment');

function isValidTimer(timeout, startingPoint, interval) {
    if (timeout <= 0) return true;

    const currentTimePoint = new moment();
    const duration = moment.duration(currentTimePoint.diff(startingPoint)).asMinutes();
    if (duration >= timeout) {
        clearInterval(interval);
        tl.setResult(tl.TaskResult.Failed, 'Defined timeout elapsed');
        return false;
    }
    return true;
}

async function run() {
    const startingPoint = new moment();

    try {
        const url = tl.getVariable("SYSTEM_TEAMFOUNDATIONSERVERURI") + tl.getVariable("SYSTEM_TEAMPROJECTID") + "/_apis/Release/releases/" + tl.getVariable("RELEASE_RELEASEID") + "?api-version=5.0";
        const variableName = tl.getInput('variableName', true);
        const succeedValue = tl.getInput('succeedValue', true);
        const failedValue = tl.getInput('failedValue', false);
        const timeout = tl.getInput('Timeout', true)*1;
        let failedRequestNumber = 0;

        const interval = setInterval(async () => {
            if (!isValidTimer(timeout, startingPoint, interval)) return;

            let releaseJson;
            try {
                releaseJson = JSON.parse(await request({
                    'method': 'GET',
                    'url': url,
                    'headers': {
                        'Authorization': 'Bearer ' + tl.getVariable("SYSTEM_ACCESSTOKEN"),
                        'Content-Type': 'application/json'
                    }
                }));
                failedRequestNumber = 0;
            } catch(err) {
                failedRequestNumber++;
                if (failedRequestNumber >= 5) {
                    console.error(err);
                    clearInterval(interval);
                    tl.setResult(tl.TaskResult.Failed, err.message);
                    return;
                }
            }

            try {
                const returnedValue = releaseJson.variables[variableName];
                if (returnedValue !== undefined) {
                    console.log(`Returned value of ${variableName} = ${returnedValue}`);
                    clearInterval(interval);

                    if (returnedValue === failedValue)
                        throw 'Failed value returned.';
                    else if (returnedValue !== failedValue && returnedValue !== succeedValue)
                        throw 'Unsupported value was returned';
                }
            } catch (err) {
                console.error(err);
                tl.setResult(tl.TaskResult.Failed, err.message);
            }
        }, 5000);
    }
    catch (err) {
        console.error(err);
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

(async() => {
    await run();
})();
