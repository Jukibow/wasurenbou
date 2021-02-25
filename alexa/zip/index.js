/* eslint-disable  func-names */
/* eslint quote-props: ["error", "consistent"]*/
/**
 * This sample demonstrates a simple skill built with the Amazon Alexa Skills
 * nodejs skill development kit.
 * This sample supports multiple lauguages. (en-US, en-GB, de-DE).
 * The Intent Schema, Custom Slots and Sample Utterances for this skill, as well
 * as testing instructions are located at https://github.com/alexa/skill-sample-nodejs-fact
 **/

'use strict';
const Alexa = require('alexa-sdk');

//=====================================================================================================================================
const {google} = require('googleapis');
const {OAuth2Client} = require('google-auth-library');

const writeToSpreadsheet = (size) => {
    let scriptId = process.env['GOOGLE_SCRIPT_ID'];
    let functionName = "addListFromAlexa";
    const auth = new OAuth2Client(process.env['GOOGLE_CLIENT_ID'], process.env['GOOGLE_CLIENT_SECRET']);
    auth.setCredentials({
        access_token: process.env['GOOGLE_ACCESS_TOKEN'],
        refresh_token: process.env['GOOGLE_REFRESH_TOKEN']
    });
    const script = google.script('v1');
    return new Promise((resolve, reject) => {
        script.scripts.run({
            auth: auth,
            scriptId: scriptId,
            resource: {
                function: functionName,
                parameters: [{
                    "query_result": {
                        "store": store,
                        "target": target
                    }
                }],
                devMode: true
            }
        }, (err, result) => {
            if (err) {
                console.log(err);
                reject(new Error(err));
            } else {
                resolve(result);
            }
        });
    });
};
//=========================================================================================================================================



//Replace with your app ID (OPTIONAL).  You can find this value at the top of your skill's page on http://developer.amazon.com.
//Make sure to enclose your value in quotes, like this: const APP_ID = 'amzn1.ask.skill.bb4045e6-b3e8-4133-b650-72923c5980f1';
const APP_ID = process.env['ALEXA_APP_ID'];

exports.handler = function (event, context, callback) {
    const alexa = Alexa.handler(event, context, callback);
    alexa.APP_ID = APP_ID;
    const handlers = {
        'WasurenbouIntent': function () {
            //let size = event.request.intent.slots.Size.name; //キー名
            // let size = event.request.intent.slots.Size.value;
            let store = event.request.intent.slots.store.resolutions.resolutionsPerAuthority[0].values[0].value.id;
            let target = event.request.intent.slots.target.resolutions.resolutionsPerAuthority[0].values[0].value.id;
            console.log('store: ' + store);
            writeToSpreadsheet(size).then(() => {
                this.emit(':tell', store + 'に' + target + 'を書き込みました');
            }).catch(error => {
                context.fail(error);
                this.emit(':tell', '書き込みに失敗しました');
            });
        },
        'AMAZON.HelpIntent': function () {
            this.emit(':tell', '買うお店と商品を教えてください');
        },
        // キャンセル（デフォルト）への返答
        'AMAZON.CancelIntent': function () {
            this.emit(':tell', 'キャンセルします');
        },
        // 対応できないアクションへの返答
        'AMAZON.StopIntent': function () {
            this.emit(':tell', '何言ってんだおめえ');
        },
    };
    alexa.registerHandlers(handlers);
    alexa.execute();
};
