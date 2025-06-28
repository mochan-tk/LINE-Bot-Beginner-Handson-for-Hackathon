'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
const { AzureOpenAI } = require("openai");

const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME; // model = "deployment name".
const apiVersion = "2024-10-21";
const key = process.env.AZURE_OPENAI_KEY;
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const openaiClient = new AzureOpenAI({
  apiKey: key,
  deployment: deployment,
  endpoint: endpoint,
  apiVersion: apiVersion,
});

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
  } else if (event.message.type === 'image') {
    //https://developers.line.biz/ja/reference/messaging-api/#image-message
    const stream = await blobClient.getMessageContent(event.message.id);
    const contents = await getStreamData(stream);
    const base64_data = "data:image/jpeg;base64," + Buffer.concat(contents).toString('base64');

    // モデルに渡すメッセージ情報の作成
    let messages = [
      { role: "system", content: "あなたは特定のキャラクターの名前を当てるAIアシスタントです。キャラクターたちは結構似ているのでよーく特徴を見て答えを出してください。見分けるポイントは頭部の色に注目です。書かれている文字に騙されないようにしてください。キャラクターの名前は「くりまんじゅう」、「ハチワレ」、「ちいかわ」のいずれかです。他のキャラクターの画像には「わかりません。」と答えてください。" },
    ];

    // ユーザーのメッセージをセット
    messages.push({ 
        role: "user", 
        content: [
          {
            type: "text",
            text: "このキャラクターの名前は？",
          },
          {
            type: "image_url",
            image_url: {
              url: base64_data,
              detail: "low",
            },
          }
        ]
    });

    console.log(`Messages: ${messages.map((m) => m.content).join("\n")}`);
    
    const events = await openaiClient.chat.completions.create({
      messages: messages,
      model: "",
      max_tokens: 128,
      stream: true,
    });

    let msg = '';
    for await (const event of events) {
      for (const choice of event.choices) {
        const delta = choice.delta?.content;
        if (delta !== undefined) {
          msg　 += `${delta}`;
          // console.log(`Chatbot: ${delta}`);
        }
      }
    }

    // create an echoing text message
    console.log(msg);
    const echo = { type: 'text', text: msg };

    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [echo],
    });

  }

  const echo = { type: 'text', text: "ちいかわキャラクターの画像を送ってね！" };

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

// listen on port
const port = process.env.PORT || 7071;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});