// netlify/functions/test-api.js

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbytmRXdRHuph7OnrZfUoFQSd8VcZxnmf_H-CW-2qPVm_Sy6R4AX2ERGZcDHgLo8l76w/exec"; // Βάλε εδώ το ΤΕΛΕΥΤΑΙΟ /exec

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event, context) => {
  // Preflight για browser
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "method_not_allowed" }),
    };
  }

  try {
    // Στέλνουμε το ίδιο body στο Apps Script
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: event.body,
    });

    const text = await res.text();

    return {
      statusCode: res.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
