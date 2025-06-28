'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
const crypto = require("crypto");
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL;
const BASE_PUBLIC_DIR = 'public';

// create LINE SDK config from env variables
const config = {
  channelSecret: process.env.CHANNEL_SECRET,
};

// create LINE SDK client
const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
});
const blobClient = new line.messagingApi.MessagingApiBlobClient({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
});

// create Express app
// about Express itself: https://expressjs.com/
const app = express();

// serve static and downloaded files
app.use(`/${BASE_PUBLIC_DIR}`, express.static(BASE_PUBLIC_DIR));

// register a webhook handler with middleware
// about the middleware, please refer to doc
app.post('/callback', line.middleware(config), (req, res) => {
  console.log('start');
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// event handler
async function handleEvent(event) {
    const userId = event.source.userId;
  
    if (event.type !== 'message' && event.type !== 'postback') {
      // ignore non-text-message event
      return Promise.resolve(null);
    } else if (event.type === 'postback') {
      if (event.postback.data === 'sticker') {
        //https://developers.line.biz/ja/reference/messaging-api/#sticker-message
        //https://developers.line.biz/ja/docs/messaging-api/sticker-list/#sticker-definitions
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [{
            type: 'sticker',
            packageId: "11537",
            stickerId: "52002735"
          }]
        });
      }
    
    } else if (event.message.type === 'text') {
      if (event.message.text === 'flex') {
        //https://developers.line.biz/ja/reference/messaging-api/#flex-message
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [{
            type: 'flex',
            altText: 'item list',
            contents: flexMsg
          }]
        });
      } else if (event.message.text === 'quick') {
        //https://developers.line.biz/ja/reference/messaging-api/#quick-reply
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [{
            type: 'text',
            text: 'ステッカー欲しいですか❓YesかNoで答えてください, もしくは素敵な写真送って❗️',
            "quickReply": {
              "items": [
                {
                  "type": "action",
                  "action": {
                    "type":"postback",
                    "label":"Yes",
                    "data": "sticker",
                    "displayText":"ステッカーください❗️"
                  }
                },
                {
                  "type": "action",
                  "action": {
                    "type":"message",
                    "label":"No",
                    "text":"不要。"
                  }
                },
                {
                  "type": "action",
                  "action": {
                    "type": "camera",
                    "label": "camera"
                  }
                }
              ]
            }
          }]
        });
      }
    
    } else if (event.message.type === 'image') {
      //https://developers.line.biz/ja/reference/messaging-api/#image-message
      const stream = await blobClient.getMessageContent(event.message.id);
      const contents = await getStreamData(stream);
      const uploadFileName = `${crypto.randomBytes(20).toString('hex')}.jpg`;
      const savePath = path.join(__dirname, BASE_PUBLIC_DIR, uploadFileName);
      fs.appendFile(savePath, Buffer.concat(contents), (err) => {
        if (err) throw err;
        console.log("success");
      });
      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'image',
          originalContentUrl: `${BASE_URL}/${BASE_PUBLIC_DIR}/${uploadFileName}`,
          previewImageUrl: `${BASE_URL}/${BASE_PUBLIC_DIR}/${uploadFileName}`
        }]
      });
    } else if (event.message.type === 'audio') {
      //https://developers.line.biz/ja/reference/messaging-api/#audio-message
      //durationはこれでとれそう？ > https://www.npmjs.com/package/mp3-duration
      const stream = await blobClient.getMessageContent(event.message.id);
      const contents = await getStreamData(stream);
      const uploadFileName = `${crypto.randomBytes(20).toString('hex')}.mp3`;
      const savePath = path.join(__dirname, BASE_PUBLIC_DIR, uploadFileName);
      fs.appendFile(savePath, Buffer.concat(contents), (err) => {
        if (err) throw err;
        console.log("success");
      });
      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'audio',
          originalContentUrl: `${BASE_URL}/${BASE_PUBLIC_DIR}/${uploadFileName}`,
          duration: 60000
        }]
      });
    } else if (event.message.type === 'location') {
      //https://developers.line.biz/ja/reference/messaging-api/#location-message
      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'location',
          title: 'my location',
          address: event.message.address,
          latitude: event.message.latitude,
          longitude: event.message.longitude
        }]
      });
    }
  

    // create a echoing text message
    const echo = { type: 'text', text: event.message.text };

    // use reply API
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [echo],
    });
}

const getStreamData = async (stream)  => {
    return new Promise(resolve => {
      let result = [];
      stream.on("data", (chunk) => {
        result.push(Buffer.from(chunk));
      });
      stream.on("end", () => {
        resolve(result);
      });
    });
}

//https://developers.line.biz/flex-simulator/
const flexMsg = {
    "type": "carousel",
    "contents": [
      {
        "type": "bubble",
        "hero": {
          "type": "image",
          "size": "full",
          "aspectRatio": "20:13",
          "aspectMode": "cover",
          "url": "https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_5_carousel.png"
        },
        "body": {
          "type": "box",
          "layout": "vertical",
          "spacing": "sm",
          "contents": [
            {
              "type": "text",
              "text": "Arm Chair, White",
              "wrap": true,
              "weight": "bold",
              "size": "xl"
            },
            {
              "type": "box",
              "layout": "baseline",
              "contents": [
                {
                  "type": "text",
                  "text": "$49",
                  "wrap": true,
                  "weight": "bold",
                  "size": "xl",
                  "flex": 0
                },
                {
                  "type": "text",
                  "text": ".99",
                  "wrap": true,
                  "weight": "bold",
                  "size": "sm",
                  "flex": 0
                }
              ]
            }
          ]
        },
        "footer": {
          "type": "box",
          "layout": "vertical",
          "spacing": "sm",
          "contents": [
            {
              "type": "button",
              "style": "primary",
              "action": {
                "type": "uri",
                "label": "Add to Cart",
                "uri": "https://linecorp.com"
              }
            },
            {
              "type": "button",
              "action": {
                "type": "uri",
                "label": "Add to wishlist",
                "uri": "https://linecorp.com"
              }
            }
          ]
        }
      },
      {
        "type": "bubble",
        "hero": {
          "type": "image",
          "size": "full",
          "aspectRatio": "20:13",
          "aspectMode": "cover",
          "url": "https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_6_carousel.png"
        },
        "body": {
          "type": "box",
          "layout": "vertical",
          "spacing": "sm",
          "contents": [
            {
              "type": "text",
              "text": "Metal Desk Lamp",
              "wrap": true,
              "weight": "bold",
              "size": "xl"
            },
            {
              "type": "box",
              "layout": "baseline",
              "flex": 1,
              "contents": [
                {
                  "type": "text",
                  "text": "$11",
                  "wrap": true,
                  "weight": "bold",
                  "size": "xl",
                  "flex": 0
                },
                {
                  "type": "text",
                  "text": ".99",
                  "wrap": true,
                  "weight": "bold",
                  "size": "sm",
                  "flex": 0
                }
              ]
            },
            {
              "type": "text",
              "text": "Temporarily out of stock",
              "wrap": true,
              "size": "xxs",
              "margin": "md",
              "color": "#ff5551",
              "flex": 0
            }
          ]
        },
        "footer": {
          "type": "box",
          "layout": "vertical",
          "spacing": "sm",
          "contents": [
            {
              "type": "button",
              "flex": 2,
              "style": "primary",
              "color": "#aaaaaa",
              "action": {
                "type": "uri",
                "label": "Add to Cart",
                "uri": "https://linecorp.com"
              }
            },
            {
              "type": "button",
              "action": {
                "type": "uri",
                "label": "Add to wish list",
                "uri": "https://linecorp.com"
              }
            }
          ]
        }
      },
      {
        "type": "bubble",
        "body": {
          "type": "box",
          "layout": "vertical",
          "spacing": "sm",
          "contents": [
            {
              "type": "button",
              "flex": 1,
              "gravity": "center",
              "action": {
                "type": "uri",
                "label": "See more",
                "uri": "https://linecorp.com"
              }
            }
          ]
        }
      }
    ]
  }

// listen on port
const port = process.env.PORT || 7071;
app.listen(port, () => {
  console.log(`listening on ${port}`);
  console.log(config);
});