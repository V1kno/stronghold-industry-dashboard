// /api/data.js — Pre-fetches real government data for industry analysis
// Sources: Bureau of Labor Statistics (BLS), Federal Reserve (FRED)

// BLS Current Employment Statistics series mapping
const BLS_SERIES = {
  "Manufacturing": { emp: "CES3000000001", wage: "CES3000000003", prodEmp: "CES3100000001" },
  "Healthcare IT": { emp: "CES6562000001", wage: "CES6562000003", prodEmp: "CES6562000006" },
  "Financial Services": { emp: "CES5552000001", wage: "CES5552000003", prodEmp: "CES5552000006" },
  "Retail & E-Commerce": { emp: "CES4200000001", wage: "CES4200000003", prodEmp: "CES4200000006" },
  "Construction": { emp: "CES2000000001", wage: "CES2000000003", prodEmp: "CES2000000006" },
  "Cybersecurity": { emp: "CES5051200001", wage: "CES5051200003", prodEmp: "CES5051200006" },
  "Cloud Computing": { emp: "CES5051200001", wage: "CES5051200003", prodEmp: "CES5051200006" },
  "Managed Services (MSP)": { emp: "CES5051200001", wage: "CES5051200003", prodEmp: "CES5051200006" },
  "Legal Tech": { emp: "CES5054100001", wage: "CES5054100003", prodEmp: "CES5054100006" },
  "Education": { emp: "CES6561000001", wage: "CES6561000003", prodEmp: "CES6561000006" },
  "Logistics": { emp: "CES4348400001", wage: "CES4348400003", prodEmp: "CES4348400006" },
  "Energy": { emp: "CES1021000001", wage: "CES1021000003", prodEmp: "CES1021000006" },
  "Government / Public Sector": { emp: "CES9000000001", wage: "CES9000000003", prodEmp: "CES9000000006" },
};

// FRED series for macro indicators
const FRED_SERIES = {
  gdpGrowth: "A191RL1Q225SBEA",    // Real GDP growth rate
  unemployment: "UNRATE",            // Unemployment rate
  cpi: "CPIAUCSL",                   // Consumer Price Index
  fedRate: "FEDFUNDS",               // Federal funds rate
  techInvestment: "Y006RC1Q027SBEA", // Private fixed investment in IT
  laborProductivity: "OPHNFB",       // Nonfarm business labor productivity
};

// BLS Occupational Employment series by industry
const OES_SERIES = {
  "Manufacturing": ["51-0000", "17-2112", "15-1256", "11-3051", "51-1011"],
  "Healthcare IT": ["15-1256", "29-1141", "11-9111", "29-2010", "15-1232"],
  "Financial Services": ["13-2011", "15-1256", "13-2051", "11-3031", "43-3011"],
  "Cybersecurity": ["15-1212", "15-1256", "15-1231", "11-3021", "15-1299"],
  "Cloud Computing": ["15-1254", "15-1256", "15-1244", "11-3021", "15-1232"],
  "Managed Services (MSP)": ["15-1232", "15-1256", "15-1244", "11-3021", "43-4051"],
  "Retail & E-Commerce": ["41-1012", "15-1256", "13-1161", "43-4051", "11-2021"],
  "Legal Tech": ["23-1011", "15-1256", "23-2011", "43-6012", "15-1232"],
};

async function fetchBLS(seriesIds, startYear = "2022", endYear = "2025") {
  const blsKey = process.env.BLS_API_KEY; // optional, increases rate limit
  try {
    const body = {
      seriesid: seriesIds,
      startyear: startYear,
      endyear: endYear,
      calculations: true,
      annualaverage: true,
    };
    if (blsKey) body.registrationkey = blsKey;

    const resp = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (data.status === "REQUEST_SUCCEEDED") return data.Results?.series || [];
    return [];
  } catch (e) {
    console.error("BLS fetch error:", e);
    return [];
  }
}

async function fetchFRED(seriesId) {
  const fredKey = process.env.FRED_API_KEY;
  if (!fredKey) return null;
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${fredKey}&file_type=json&sort_order=desc&limit=12`;
    const resp = await fetch(url);
    const data = await resp.json();
    return data.observations || [];
  } catch (e) {
    console.error("FRED fetch error:", e);
    return null;
  }
}

function extractLatest(series, seriesId) {
  const match = series.find(s => s.seriesID === seriesId);
  if (!match || !match.data?.length) return null;
  // Get the most recent non-preliminary data point
  const sorted = match.data.sort((a, b) => {
    const ya = parseInt(a.year), yb = parseInt(b.year);
    if (ya !== yb) return yb - ya;
    return parseInt(b.period.replace("M", "")) - parseInt(a.period.replace("M", ""));
  });
  return sorted[0] ? { value: parseFloat(sorted[0].value), year: sorted[0].year, period: sorted[0].period } : null;
}

function calcGrowth(series, seriesId) {
  const match = series.find(s => s.seriesID === seriesId);
  if (!match || !match.data?.length) return null;
  const sorted = match.data.sort((a, b) => {
    const ya = parseInt(a.year), yb = parseInt(b.year);
    if (ya !== yb) return yb - ya;
    return parseInt(b.period.replace("M", "")) - parseInt(a.period.replace("M", ""));
  });
  if (sorted.length < 13) return null;
  const current = parseFloat(sorted[0].value);
  const yearAgo = parseFloat(sorted[12].value);
  if (yearAgo === 0) return null;
  return +(((current - yearAgo) / yearAgo) * 100).toFixed(1);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { industry } = req.body;
  if (!industry) return res.status(400).json({ error: "Industry required" });

  const result = {
    source: "BLS / FRED (U.S. Government)",
    industry,
    timestamp: new Date().toISOString(),
    employment: null,
    wages: null,
    employmentGrowthPct: null,
    macro: {},
    dataAvailable: false,
  };

  try {
    // 1. Fetch BLS employment + wage data
    const mapping = BLS_SERIES[industry] || BLS_SERIES["Manufacturing"];
    const seriesIds = [mapping.emp, mapping.wage].filter(Boolean);

    if (seriesIds.length) {
      const blsData = await fetchBLS(seriesIds);

      if (blsData.length) {
        result.dataAvailable = true;

        // Employment
        const empData = extractLatest(blsData, mapping.emp);
        if (empData) {
          result.employment = {
            count: empData.value * 1000, // BLS reports in thousands
            countFormatted: `${(empData.value / 1000).toFixed(1)}M`,
            asOf: `${empData.year}-${empData.period}`,
            seriesId: mapping.emp,
          };
          result.employmentGrowthPct = calcGrowth(blsData, mapping.emp);
        }

        // Wages
        const wageData = extractLatest(blsData, mapping.wage);
        if (wageData) {
          result.wages = {
            avgHourly: wageData.value,
            avgAnnual: Math.round(wageData.value * 2080),
            avgAnnualFormatted: `$${(wageData.value * 2080 / 1000).toFixed(0)}K`,
            asOf: `${wageData.year}-${wageData.period}`,
            seriesId: mapping.wage,
          };
        }
      }
    }

    // 2. Fetch FRED macro indicators
    const fredKey = process.env.FRED_API_KEY;
    if (fredKey) {
      const [gdpObs, unempObs, cpiObs, prodObs] = await Promise.all([
        fetchFRED(FRED_SERIES.gdpGrowth),
        fetchFRED(FRED_SERIES.unemployment),
        fetchFRED(FRED_SERIES.cpi),
        fetchFRED(FRED_SERIES.laborProductivity),
      ]);

      if (gdpObs?.length) {
        const latest = gdpObs.find(o => o.value !== ".");
        if (latest) result.macro.gdpGrowthPct = parseFloat(latest.value);
      }
      if (unempObs?.length) {
        const latest = unempObs.find(o => o.value !== ".");
        if (latest) result.macro.unemploymentPct = parseFloat(latest.value);
      }
      if (cpiObs?.length && cpiObs.length >= 13) {
        const current = parseFloat(cpiObs[0].value);
        const yearAgo = parseFloat(cpiObs[12].value);
        if (yearAgo > 0) result.macro.inflationPct = +(((current - yearAgo) / yearAgo) * 100).toFixed(1);
      }
      if (prodObs?.length) {
        const latest = prodObs.find(o => o.value !== ".");
        if (latest) result.macro.laborProductivityGrowth = parseFloat(latest.value);
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Data API error:", error);
    return res.status(200).json({ ...result, error: error.message });
  }
}
