'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
// https://platform.openai.com/docs/guides/text-generation?text-generation-quickstart-example=text
const { OpenAI } = require('openai');

const openaiClient = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

// 会話履歴の保存（本当はDBを使った方が良い、ハンズオンなので簡単な方法で実施した）
let chatHistory = {};  

// データを追加する関数  
function saveChatHistory(id, currentHistory) {  

  if (!chatHistory[id]) {  
    chatHistory[id] = [];  
  }  

  // 履歴は最大10件までにしておく
  if (chatHistory[id].length >= 10) {  
    chatHistory[id].splice(0, 2); // 最古のメッセージを削除  
  }  

  chatHistory[id] = currentHistory;
}  

// データを取得する関数  
function getChatHistory(id) {  
  if (chatHistory[id]) {  
      console.log(`Customer retrieved: ${id}`);  
      return chatHistory[id];  
  } else {  
      console.log(`Chat History not found for id: ${id}`);  
      return []; 
  }  
}  

// create LINE SDK config from env variables
const config = {
  channelSecret: process.env.CHANNEL_SECRET,
};

// create LINE SDK client
const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
});

// create Express app
// about Express itself: https://expressjs.com/
const app = express();

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

  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null);
  }

  // モデルに渡すメッセージ情報の作成
  let messages = [
    { role: "system", content: "あなたは日本語を話すAIアシスタントです。マラソン好きでマラソンに詳しいAIでもあり、なるべく短い文でクイックに返事を返します。" },
  ];

  let lastHistory = getChatHistory(userId);

  messages = messages.concat(lastHistory)

  // ユーザーのメッセージをセット
  messages.push({ role: "user", content: event.message.text });

  console.log(`Messages: ${messages.map((m) => m.content).join("\n")}`);

  let msg = '';
  const completion = await openaiClient.chat.completions.create({
    model: "gpt-4o",
    // model: "ft:gpt-4o-mini-2024-07-18:personal::AX0kz3eh",
    messages: messages,
    store: true
  });

  msg = completion.choices[0].message.content;

  // 会話履歴の保存
  lastHistory.push({ role: "user", content: event.message.text });
  lastHistory.push({ role: "assistant", content: msg });
  saveChatHistory(userId, lastHistory);

  // // DEBUG用:for文でメッセージを順番に処理  
  // for (let i = 0; i < lastHistory.length; i++) {  
  //   console.log(`Message ${i + 1}:　Content - ${lastHistory[i].content}`);  
  // }  

  // create an echoing text message
  console.log(msg);
  const echo = { type: 'text', text: msg };

  // use reply API
  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [echo],
  });
}

// listen on port
const port = process.env.PORT || 7071;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});