import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 25,
  duration: "5m",
  thresholds: {
    http_req_failed: ["rate==0"],
    http_req_duration: ["p(95)<2000"],
  },
};

const baseUrl = __ENV.BASE_URL;
if (!baseUrl) {
  throw new Error("BASE_URL is required");
}

export default function () {
  const responses = http.batch([
    ["GET", `${baseUrl}/api/maintenance/status`],
    ["GET", `${baseUrl}/api/exam-calls/active`],
    ["GET", `${baseUrl}/api/exam-schedules?registrationOpen=true`],
  ]);

  for (const response of responses) {
    check(response, {
      "response is successful": (result) => result.status >= 200 && result.status < 300,
    });
  }
}
