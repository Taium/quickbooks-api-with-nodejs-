var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var cors = require("cors");
const axios = require("axios");
const qs = require("qs");

const bodyParser = require("body-parser");
require("dotenv").config();

import { NextFunction, Request, Response } from "express";

import { CompanyInfo } from "./models/Index.model";
import indexRouter from "./routers/index.router";

const { connectDB } = require("./config/db.config");

var app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(bodyParser.text());
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());
connectDB();

app.get("/", (req: any, res: any) => {
  res.send("Hello from Express");
});


let accessToken: any = null; // Store tokens securely in a production app

app.get("/auth/quickbooks", (req: any, res: any) => {
  const companyName = req.query.companyName || "default-company"; // Fallback if not provided
  const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${
    process.env.CLIENT_ID
  }&redirect_uri=${
    process.env.REDIRECT_URI
  }&response_type=code&scope=com.intuit.quickbooks.accounting&state=${encodeURIComponent(
    companyName
  )}`;

  res.redirect(authUrl);
});

app.get("/auth/callback", async (req: any, res: any) => {
  const { code, state: companyName, realmId } = req.query; // 'realmId' is passed by QuickBooks on callback
  try {
    const response = await axios.post(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      qs.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.REDIRECT_URI,
      }),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    accessToken = response.data.access_token;

    // Ensure you have the realmId from the callback query params
    if (!realmId) {
      throw new Error("realmId not provided by QuickBooks");
    }

    // Fetch company info
    const companyResponse = await axios.get(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    const companyInfo = companyResponse.data.CompanyInfo;

    // Prepare the data to save
    const companyData = {
      realmId,
      companyName: companyInfo.CompanyName,
      address: companyInfo.CompanyAddr?.Line1 || "N/A",
      industryType: companyInfo.IndustryType || "N/A",
      contactDetails: companyInfo.PrimaryPhone?.FreeFormNumber || "N/A",
    };

    // Save to MongoDB
    await CompanyInfo.findOneAndUpdate(
      { uniqueField: "singleCompany" }, // Replace with your chosen unique field
      companyData,
      { upsert: true, new: true }
    );

    console.log("Company information saved to MongoDB");

    // Redirect dynamically using the company name
    res.redirect(
      `http://localhost:5173/company/${encodeURIComponent(
        companyName
      )}/reports/financial-statement-classification`
    );
  } catch (error) {
    console.error("Error during company info retrieval:", error);
    res
      .status(500)
      .send("Error during authentication or company info retrieval");
  }
});

const validateToken = async (token: any) => {
  try {
    const response = await axios.get(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${process.env.COMPANY_ID}/companyinfo/${process.env.COMPANY_ID}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    // If we get a 200 response, the token is still valid
    console.log("Token is valid");
    return true;
  } catch (error: any) {
    console.error(
      "Token validation failed:",
      error.response ? error.response.data : error.message
    );
    return false;
  }
};

app.get("/auth/check-token", async (req: any, res: any) => {
  const item: any = await CompanyInfo.findOne();
  if (accessToken) {
    // Use a function to validate the token with QuickBooks API or check token expiry
    validateToken(accessToken)
      .then((isValid) => {
        if (isValid) {
          res.status(200).json({ valid: true, companyInfo: item });
        } else {
          res.status(401).json({ valid: false });
        }
      })
      .catch((error) => {
        console.error("Error validating token:", error);
        res.status(500).json({ valid: false });
      });
  } else {
    res.status(401).json({ valid: false });
  }
});

app.get("/api/profit-loss", async (req: any, res: any) => {
  if (!accessToken) return res.status(401).send("Unauthorized");
  const item: any = await CompanyInfo.findOne();

  const companyId = item?.realmId;

  // Destructure the query parameters from the request
  const {
    start_date,
    end_date,
    summarize_column_by,
    minorversion,
    customerId,
  } = req.query;

  // Set default values if parameters are not provided
  const startDate = start_date || "2024-01-01";
  const endDate = end_date || "2024-12-31";
  const summarizeBy = summarize_column_by || "Month";
  const version = minorversion || "65";

  try {
    const response = await axios.get(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${companyId}/reports/ProfitAndLoss?customer=${customerId}&start_date=${startDate}&end_date=${endDate}&summarize_column_by=${summarizeBy}&minorversion=${version}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to fetch report");
  }
});
app.get("/api/customers", async (req: any, res: any) => {
  try {
    if (!accessToken) {
      return res
        .status(401)
        .send("Unauthorized: Access token is missing or invalid");
    }

    const item: any = await CompanyInfo.findOne();
    const companyId = item?.realmId;

    if (!companyId) {
      return res.status(400).send("Company ID not found");
    }

    const response = await axios.get(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${companyId}/query?query=select * from Customer`,

      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    const customers = response.data.QueryResponse.Customer || [];
    res.json(customers);
  } catch (error: any) {
    console.error(
      "Error fetching customer list:",
      error.response?.data || error.message
    );
    res.status(500).send("Failed to fetch customer list");
  }
});

app.get("/api/balance-sheet", async (req: any, res: any) => {
  if (!accessToken) return res.status(401).send("Unauthorized");

  const item: any = await CompanyInfo.findOne();

  const companyId = item?.realmId;

  // Destructure the query parameters from the request
  const {
    start_date,
    end_date,
    summarize_column_by,
    minorversion,
    customerId,
  } = req.query;

  // Set default values if parameters are not provided
  const startDate = start_date || "2024-01-01";
  const endDate = end_date || "2024-12-31";
  const summarizeBy = summarize_column_by || "Month";
  const version = minorversion || "65";

  try {
    const response = await axios.get(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${companyId}/reports/BalanceSheet?customer=${customerId}&start_date=${startDate}&end_date=${endDate}&summarize_column_by=${summarizeBy}&minorversion=${version}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    // Return the balance sheet data dynamically based on query params
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to fetch balance sheet report");
  }
});

// catch 404 and forward to error handler
app.use(function (req: Request, res: Response, next: NextFunction) {
  next(createError(404));
});

// error handler
app.use(function (err: any, req: Request, res: Response, next: NextFunction) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500).json("error");
});

//start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running in port --> ${PORT}`));
