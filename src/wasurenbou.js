//CHANNEL_ACCESS_TOKENを設定
//LINE developerで登録をした、CHANNEL_ACCESS_TOKENを入力する
const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty("CHANNEL_ACCESS_TOKEN");
const line_endpoint = PropertiesService.getScriptProperties().getProperty("LINE_ENDPOINT_REPLY");
const line_endpoint_push = PropertiesService.getScriptProperties().getProperty("LINE_ENDPOINT_PUSH");
const line_endpoint_broadcast = PropertiesService.getScriptProperties().getProperty("LINE_ENDPOINT_BROADCAST");

const userId = PropertiesService.getScriptProperties().getProperty("USER_ID");

//SpreadSheetの取得
const SS = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SPLEADSHEET"));
const sheet = {
  buy: SS.getSheetByName("買い物リスト"), //Spreadsheetのシート名（タブ名）
  dinner: SS.getSheetByName("晩ご飯"),
  status: SS.getSheetByName("ステータス")
}
const lastRowForBuy = sheet.buy.getLastRow();
const lastColForBuy = sheet.buy.getLastColumn();
const sheetDataForBuy = sheet.buy.getSheetValues(2, 1, lastRowForBuy, lastColForBuy);

const lastRowForDinner = sheet.dinner.getLastRow();
const lastColForDinner = sheet.dinner.getLastColumn();
const sheetDataForDinner = sheet.dinner.getSheetValues(2, 1, lastRowForBuy, lastColForBuy);

// ステータス取得
const getStatus = sheet.status.getRange(1, 1).getValue();

const statusCd = {
  init: sheet.status.getRange(2, 3).getValue(),
  waitAddList: sheet.status.getRange(3, 3).getValue(),
  waitAddDinner: sheet.status.getRange(4, 3).getValue()
}

//店舗問合せ
const stores = {
  sugi: "スギ薬局",
  itoyokado: "イトーヨーカドー",
  daiso: "100均",
  supermarket: "スーパー",
  list: "リスト",
  other: "その他"
}

// 列番号
const column = {
  store: 1,
  target: 2,
  deadline: 3
}

// 毎日通知時間（平日）
const alert = {
  hour: 17,
  minute: 30
}

// 毎日通知時間（休日）
const alert_holiday = {
  hour: 12,
  minute: 30
}

// メッセージ
const message = {
  error: "何言ってんだおめえ",
}

// リスト追加の合言葉
const addMassage = "追加";

// 晩ご飯追加の合言葉
const addDinnerMassage = "晩ご飯";

// 晩ご飯表示の合言葉
const checkTodayDinner = "今日の晩ご飯";

// ヘルプ
const help = {
  key: "ヘルプ",
  message: "●追加したい場合\n" +
    "「追加 (店舗) (商品) (期限)」と入力する。\n" +
    "期限の入力の仕方は、20210220のように、年月日の順番で入力する。（/は無しで、2月なら02のように0をつける)" +
    "期限は、入力しなければ今日で登録される。（19時以降は明日で登録される）\n\n" +
    "●買い物リストが見たい場合\n" +
    "全てが見たい場合は、「リスト」と入力し、店ごとに見たい場合は、登録した店舗名を入力する。" +
    "メニューのボタンを押しても見れる。"
}

// 次の日の買い物リストに登録する時間
const toNextDay = "1900";

//POSTデータ取得、JSONをパースする
function doPost(e) {
  let json = JSON.parse(e.postData.contents);

  //返信するためのトークン取得
  let reply_token= json.events[0].replyToken;
  if (typeof reply_token === 'undefined') {
    return;
  }

  //送られたLINEメッセージを取得
  let user_message = json.events[0].message.text;

  let reply_messages = reply(user_message);

  // メッセージを返信（以下固定）
  let messages = reply_messages.map(function (v) {
    return {'type': 'text', 'text': v};
  });
  UrlFetchApp.fetch(line_endpoint, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'replyToken': reply_token,
      'messages': messages,
    }),
  });
  return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);
}

function reply(user_message) {
  // メッセージを分解
  user_message = user_message.split(/[ 　]/);

  let todayList;
  let reply_messages;
  if (getStatus == statusCd.init) {
    // 初期状態の応答
    if (user_message[0] == help.key) {
      reply_messages = [help.message];
    } else if (user_message[0] == addMassage) {
      // 追加の場合
      sheet.status.getRange(1, 1).setValue(statusCd.waitAddList);
      reply_messages = ["何を買い物リストに追加しますか？"];
    } else if (user_message[0] == addDinnerMassage) {
      // 晩ご飯追加の場合
      sheet.status.getRange(1, 1).setValue(statusCd.waitAddDinner);
      const today = getToday();
      reply_messages = [today.getMonth() + "月" + getToday().getDate() + "日の晩ご飯は何にしますか？"];
    } else if (user_message.indexOf(checkTodayDinner) != -1) {
      // 今日の晩ご飯という単語が入っていれば
      reply_messages = [getTodayDinner()];
    } else {
      // 買い物リスト取得の場合
      todayList = getTodayList(user_message);

      // 返信する内容を作成
      if (todayList.length == 0) {
        reply_messages = [message.error];
      } else {
        console.log(todayList);
        reply_messages = todayList;
      }
    }
  } else if (getStatus == statusCd.waitAddList) {
    // 買い物リストの追加待ち
    let result = addList(user_message);
    if(result == "error") {
      reply_messages = [message.error];
    } else {
      reply_messages = [user_message[0] + "に" + user_message[1] + "を登録しました。"]
    }
    sheet.status.getRange(1, 1).setValue(statusCd.init);
  } else if (getStatus == statusCd.waitAddDinner) {
    // 晩ご飯の追加待ち
    sheet.dinner.getRange(lastRowForDinner + 1, 1).setValue(user_message[0]);
    sheet.dinner.getRange(lastRowForDinner + 1, 2).setValue(getTodayYYYYMMDD());
    const today = getToday();
    reply_messages = [today.getMonth() + "月" + getToday().getDate() + "日の晩ご飯は" + user_message[0] + "に決定！"];
    sheet.status.getRange(1, 1).setValue(statusCd.init);
  } else {
    reply_messages = [message.error];
  }
  return reply_messages;
}

// 晩ご飯一覧から今日の晩ご飯を出力する
function getTodayDinner() {
  let today = getTodayYYYYMMDD();
  let list = [];
  for (let i = 2; i < lastRowForBuy + 1; i++) {
    let date = sheet.buy.getRange(i, 2).getValue();
    console.log(date);
    if (date == today) {
      list.push(sheet.dinner.getRange(i, 1).getValue());
    }
  }
  console.log(list);

  if (list.length) return "今日の晩ご飯は決まってません。"

  let sendDinner = "今日の晩ご飯は、\n";
  for (let key in list) {
    sendDinner = key + "\n";
  }
  console.log(sendList);
  return sendList + "の予定です。";
}

// 買い物リストから今日のリストを出力する
function getTodayList(user_message) {
  let today = getTodayYYYYMMDD();
  let list = {};
  for (let i = 2; i < lastRowForBuy + 1; i++) {
    let date = sheet.buy.getRange(i, column.deadline).getValue();
    let textStore = user_message[0];
    let spreadStore = sheet.buy.getRange(i, column.store).getValue();
    let target = sheet.buy.getRange(i, column.target).getValue();
    console.log(date);
    // 送られたメッセージが"リスト"なら全て、それ以外なら対応する店を出力対象とする
    if (date == today) {
      if (textStore == stores.list) {
        if (spreadStore in list) list[spreadStore].push(target);
        else list[spreadStore] = [target];
      } else if (textStore == spreadStore) {

        if (typeof list[spreadStore] == "undefined") list[spreadStore] = [target];
        else list[spreadStore].push(target);
      }
    }
  }
  console.log(list);

  let sendList = [];
  for (let key in list) {
    // 買い物リストが登録されていなければ次へ
    if (list[key].length == 0) continue;
    let sendItem = "";
    for (i = 0; i < list[key].length; i++) {
      sendItem = sendItem + list[key][i] + "\n";
    }
    sendList.push(key + "で、\n" + sendItem + "を買いなさいな。");
  }
  console.log(sendList);
  return sendList;
}

// 買い物リストの追加
function addList (user_message) {
  if (user_message.length < 2 || user_message.length > 3) {
    return "error";
  }
  sheet.buy.getRange(lastRowForBuy + 1, column.store).setValue(user_message[0]);
  sheet.buy.getRange(lastRowForBuy + 1, column.target).setValue(user_message[1]);
  if(user_message.length == 3) {
    sheet.buy.getRange(lastRowForBuy + 1, column.deadline).setValue(user_message[2]);
  } else {
    sheet.buy.getRange(lastRowForBuy + 1, column.deadline).setValue(getTodayYYYYMMDD());
  }
  return "success";
}

// 買い物リストの追加（alexaから）
function addListFromAlexa(data){
  let store = data.query_result.store;
  let target = data.query_result.target;
  // スプレッドシートに追加
  sheet.buy.getRange(lastRowForBuy + 1, column.store).setValue(store);
  sheet.buy.getRange(lastRowForBuy + 1, column.target).setValue(target);
  sheet.buy.getRange(lastRowForBuy + 1, column.deadline).setValue(getTodayYYYYMMDD());
}

// 今日の日付を取得
function getToday () {
  let date = new Date();
  let time = Utilities.formatDate( date, 'Asia/Tokyo', 'hhmm');
  if (time > toNextDay) {
    // 19時以降は次の日の買い物リストとして加算
    date.setDate(date.getDate() + 1);
  }
  return date;
}

function getTodayYYYYMMDD() {
  date = Utilities.formatDate( getToday(), 'Asia/Tokyo', 'yyyyMMdd');
}

// 今日の買い物リストをお知らせ
function alertTodayList () {
  // まず使用済みのトリガーを削除
  delTrigger();
  Logger.log("トリガーを削除しました。");

  // 買い物リスト取得の場合
  todayList = getTodayList([stores.list]);

  // 返信する内容を作成
  if (todayList.length == 0) {
    reply_messages = ["今日は買うものないよ"];
  } else {
    console.log(todayList);
    reply_messages = ["今日は、\n" + todayList];
  }

    // メッセージを配信（以下固定）
  let messages = reply_messages.map(function (v) {
    return {'type': 'text', 'text': v};
  });
  UrlFetchApp.fetch(line_endpoint_broadcast, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'messages': messages,
    }),
  });
  return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);
}

// トリガーを設定
function setTrigger() {
  const time = new Date();
  console.log(time);
    // 土日は12:30に通知
  if (isHoliday(time)) {
    time.setHours(alert_holiday.hour);
    time.setMinutes(alert_holiday.minute);
  } else {
    // 平日は17:30に通知
    time.setHours(alert.hour);
    time.setMinutes(alert.minute);
  }

  ScriptApp.newTrigger('alertTodayList').timeBased().at(time).create();
}

// トリガーを削除
function delTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() == "alertTodayList") {
      ScriptApp.deleteTrigger(trigger);
    }
  }
}

// 休日を取得
function isHoliday(date) {
  // 土日の判定
  if (date.getDay() == 0 || date.getDay() == 6) return true;
  // 祝日の判定
  const id = 'ja.japanese#holiday@group.v.calendar.google.com'
  const cal = CalendarApp.getCalendarById(id);
  const events = cal.getEventsForDay(date);
  //なんらかのイベントがある＝祝日
  if (events.length) return true;

  return false;
}
