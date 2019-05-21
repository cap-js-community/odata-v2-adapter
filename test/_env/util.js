"use strict";

const CR = "\r";
const LF = "\n";
const CRLF = CR + LF;

function callRead(oRequest, sPath, oHeaders) {
  oRequest = oRequest.get(sPath);
  if (oHeaders) {
    Object.keys(oHeaders).forEach(vKey => {
      oRequest.set(vKey, oHeaders[vKey]);
    });
  }
  return oRequest;
}

function callWrite(oRequest, sPath, oPayload, bUpdate, oHeaders) {
  oRequest = bUpdate ? oRequest.patch(sPath) : oRequest.post(sPath);
  oHeaders = oHeaders || {};
  Object.keys(oHeaders).forEach(vKey => {
    oRequest.set(vKey, oHeaders[vKey]);
  });
  oRequest = oRequest.set("content-type", "application/json").send(oPayload);
  return oRequest;
}

function callDelete(oRequest, sPath) {
  return oRequest.delete(sPath);
}

function callMultipart(oRequest, sPath, sPayload) {
  sPayload = sPayload.split(LF).join(CRLF);
  return oRequest
    .post(sPath)
    .accept("multipart/mixed,application/json")
    .type("multipart/mixed;boundary=boundary")
    .parse(multipartMixedToTextParser)
    .send(sPayload);
}

function multipartMixedToTextParser(res, callback) {
  let text = "";
  res.setEncoding("utf8");
  res.on("data", chunk => {
    text += chunk;
  });
  res.on("end", () => {
    res.text = text;
    callback(null, text);
  });
}

module.exports = {
  callRead,
  callWrite,
  callDelete,
  callMultipart
};
