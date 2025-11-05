# MelbQuiz MVP (Vercel)
- 纯静态：index.html + style.css + app.js + config.json
- 无后端时：自动用内置题库
- 有后端时：在 config.json 填 API_BASE 即可连 Wix

## 本地
npx serve .
# 或 python3 -m http.server 5173

## 对接 Wix
config.json:
{
  "API_BASE":"https://你的域名/_functions",
  "ENDPOINTS":{"ME":"/me","ADD_POINTS":"/points/add","RECORD_ANSWER":"/answers/record","TODAY_QUESTION":"/questions/today"}
}
