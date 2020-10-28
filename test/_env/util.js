"use strict";

const CR = "\r";
const LF = "\n";
const CRLF = CR + LF;

function callHead(request, path, headers) {
  request = request.head(path);
  if (headers) {
    Object.keys(headers).forEach((key) => {
      request.set(key, headers[key]);
    });
  }
  return request;
}

function callRead(request, path, headers) {
  request = request.get(path);
  if (headers) {
    Object.keys(headers).forEach((key) => {
      request.set(key, headers[key]);
    });
  }
  return request;
}

function callWrite(request, path, payload, update, headers) {
  request = update ? request.merge(path) : request.post(path);
  if (headers) {
    Object.keys(headers).forEach((key) => {
      request.set(key, headers[key]);
    });
  }
  request = request.set("content-type", (headers && headers["content-type"]) || "application/json").send(payload);
  return request;
}

function callDelete(request, path, headers) {
  request = request.delete(path);
  if (headers) {
    Object.keys(headers).forEach((key) => {
      request.set(key, headers[key]);
    });
  }
  return request;
}

function callMultipart(request, path, payload, boundary = "boundary", headers) {
  request = request.post(path);
  payload = payload.split(LF).join(CRLF);
  if (headers) {
    Object.keys(headers).forEach((key) => {
      request.set(key, headers[key]);
    });
  }
  return request
    .accept("multipart/mixed,application/json")
    .type(`multipart/mixed;boundary=${boundary}`)
    .parse(multipartMixedToTextParser)
    .send(payload);
}

function callStream(request, path, update, headers) {
  request = update ? request.put(path) : request.post(path);
  if (headers) {
    Object.keys(headers).forEach((key) => {
      request.set(key, headers[key]);
    });
  }
  request = request.set("content-type", (headers && headers["content-type"]) || "application/octet-stream");
  request = request.expect(update ? 204 : 201);
  return request;
}

function callBinary(request, path, file, update, headers) {
  request = update ? request.put(path) : request.post(path);
  if (headers) {
    Object.keys(headers).forEach((key) => {
      request.set(key, headers[key]);
    });
  }
  request = request.set("content-type", (headers && headers["content-type"]) || "application/octet-stream");
  request = request.send(file);
  request = request.expect(update ? 204 : 201);
  return request;
}

function callAttach(request, path, file, update, headers, fields) {
  request = update ? request.put(path) : request.post(path);
  if (headers) {
    Object.keys(headers).forEach((key) => {
      request.set(key, headers[key]);
    });
  }
  const contentType = (headers && headers["content-type"]) || "application/octet-stream";
  request = request.set("content-type", contentType);
  request = request.field("content-type", contentType);
  if (typeof file === "string") {
    request = request.field("slug", file.split("/").pop());
  }
  if (fields) {
    Object.keys(fields).forEach((key) => {
      request.field(key, fields[key]);
    });
  }
  request = request.attach("file", file);
  request = request.expect(update ? 204 : 201);
  return request;
}

function multipartMixedToTextParser(res, callback) {
  let text = "";
  res.setEncoding("utf8");
  res.on("data", (chunk) => {
    text += chunk;
  });
  res.on("end", () => {
    res.text = text;
    callback(null, text);
  });
}

function splitMultipartResponse(body, boundary = "boundary") {
  return body
    .split(new RegExp(`(?:^|\r\n)--${boundary}(?:\r\n|--\r\n$|--$)`))
    .slice(1, -1)
    .map((part) => {
      const [_meta, ..._rest] = part.split("\r\n\r\n");
      const multipart = _meta.match(/content-type:\s*multipart\/mixed;\s*boundary=([\w-]*)/i);
      if (multipart !== null) {
        const subBoundary = multipart[1];
        return splitMultipartResponse(_rest.join("\r\n\r\n"), subBoundary);
      } else {
        const contentId = _meta.match(/content-id:\s*(\w+)/i) || undefined;
        const [_info, _body] = _rest;
        const body = _body && _body.startsWith("{") ? JSON.parse(_body) : _body;
        const [_status, ..._headers] = _info.split("\r\n");
        const [protocol, _statusCode, statusText] = _status.split(/\s+/);
        const statusCode = parseInt(_statusCode);
        let headers = {};
        _headers.forEach((_header) => {
          const [key, value] = _header.split(": ");
          headers[key] = value;
        });
        return { statusCode, statusText, headers, body, contentId: contentId && contentId[1] };
      }
    });
}

module.exports = {
  callHead,
  callRead,
  callWrite,
  callDelete,
  callMultipart,
  splitMultipartResponse,
  callStream,
  callBinary,
  callAttach,
};
