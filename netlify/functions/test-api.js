// netlify/functions/test-api.js

const SCRIPT_URL = "https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLjG8XNNBxBPMOzQvEmmdJjjbplhiNQJWlMxgz3mfQL2jKqVEukfB52fdiulh3xtrOvW4UM4qhB6OGagiAj69gXmbVsBZdxnhnFe873Im6sQEjq5TKEDcCoIHWFkc1TLH1afVWBTRGAZibwXAWe8YSVkRezWCOT6NkAG-AZO6Rho6OELz12OMf5yFosPjghwECdH_JVzPZw4Oz-BlUNy44jA61M9fewgvPFPA0dbo0iQlVKp4v_OY96OovVSQPlNOKqhHmFEyAVcqUUHmXv-Ualx5lr0nQ&lib=M5L7JnYqMqXZV1to1RqvwSdPresDUHxts"; // Βάλε εδώ το ΤΕΛΕΥΤΑΙΟ /exec

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
