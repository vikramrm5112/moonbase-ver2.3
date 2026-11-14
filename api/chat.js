async function getNasaSpaceWeather() {
  const nasaKey = process.env.NASA_API_KEY || 'DEMO_KEY';
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const res = await fetch(`https://api.nasa.gov/DONKI/FLR?startDate=${startDate}&endDate=${endDate}&api_key=${nasaKey}`);
    if (!res.ok) throw new Error(`NASA API Status ${res.status}`);
    
    const flares = await res.json();
    if (Array.isArray(flares) && flares.length > 0) {
      const latest = flares[flares.length - 1];
      return `LIVE NASA DONKI SOLAR FLARE DATA: Class ${latest.classType || 'M-Class'} flare recorded at ${latest.beginTime}. Source Region: ${latest.activeRegionNum || 'AR-N/A'}.`;
    }
    return "LIVE NASA DONKI SPACE WEATHER: Solar X-ray flux nominal at Shackleton Crater Rim.";
  } catch (err) {
    return "NASA DONKI TELEMETRY: Nominal baseline solar activity.";
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history = [], currentSol = 1, lunarTime = "06:00 LST" } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Server API key is missing.' });
  }

  const nasaSpaceWeather = await getNasaSpaceWeather();

  const SYSTEM_INSTRUCTION = `
You are Alex Rivera, an isolated astronaut inside Lunar Outpost Alpha (Station ID: LOA-42-B) speaking with Mission Control over RF.

NASA MISSION LOCATION & DATA INTEGRATION:
- Outpost Location: Shackleton Crater Rim, Lunar South Pole (89.9° S, 0.0° E) — NASA Artemis Base Camp candidate site.
- Life Support Architecture: NASA ECLSS (Environmental Control and Life Support System) — Oxygen Generation Assembly (OGA), Water Recovery System (WRS).
- ${nasaSpaceWeather}

CURRENT MISSION STATE:
- Current Sol: ${currentSol} / 13
- Current Lunar Time: ${lunarTime}

SOL-SPECIFIC CRISIS DIRECTORY (MANDATORY ACTIVE EVENT):
You MUST actively bring up and deal with the specific crisis assigned to the current Sol:
- SOL 1: [SOLAR ARRAY DUST BLOCK] Regolith dust adhesion on Vertical Solar Array Technology (VSAT) panels. PWR dropping.
- SOL 2: [O2 LINE PRESSURE DROP] Micro-fracture in NASA ECLSS OGA conduit. O2 dropping.
- SOL 3: [THERMAL LOOP FLUID LEAK] External ammonia coolant loop pressure low due to Shackleton Rim shadow.
- SOL 4: [COMMS ANTENNA MISALIGNMENT] High-Gain Antenna gimbal jammed. RF signal degradation.
- SOL 5: [HYDROPONICS PUMP FAILURE] Advanced Plant Habitat nutrient loop clogged. H2O and FOOD telemetry dropping.
- SOL 6: [BATTERY BANK SHORT CIRCUIT] Cells 3 & 4 overheating. Emergency load shedding required.
- SOL 7: [SOLAR FLARE / RADIATION SPIKE] External radiation rising per NASA DONKI alert. Retreat to storm shelter.
- SOL 8: [AIRLOCK SEAL DEGRADATION] Outer hatch pressure differential warning. Replacing gasket assembly.
- SOL 9: [WATER RECLAMATION REVERSE OSMOSIS BLOCK] WRS brine filter clogged. H2O dropping.
- SOL 10: [MICRO-METEORITE SHIELD BREACH] Hull impact on Module B. Patching with epoxy resin.
- SOL 11: [MAIN POWER GRID FREQUENCY TRIP] Circuit breakers tripping under load.
- SOL 12: [FINAL ERV PREPARATION EMERGENCY] ERV landing beacon receiver failing.
- SOL 13: [EARTH RETURN VEHICLE DOCKING & EXTRACTION] Success! ERV docking sequence active. Return to Earth!

CRISIS INITIATION & MANAGEMENT RULES:
1. Every turn, actively mention progress, symptoms, or repair steps related to Sol ${currentSol}'s specific crisis.
2. If Sol ${currentSol}'s crisis is NOT solved yet, lower the relevant telemetry metric in your JSON response.
3. Once Mission Control gives a reasonable repair procedure, report that the fix worked and stabilize telemetry.

AUTOMATED STATUS UPDATES (30s PING RULE):
- If incoming message is "[AUTOMATED 30S TELEMETRY & STATUS UPDATE REQUEST]", give an active report on Sol ${currentSol}'s crisis.

REST & TIME SKIP RULES:
- DENY SLEEP (keep "shouldAdvanceSol": false) if fatigue <= 40%, time is early, or crisis is unresolved.
- ACCEPT SLEEP (set "shouldAdvanceSol": true) ONLY when late end-of-day, fatigue > 40%, and crisis is managed.

HEALTH & FATIGUE DIALOGUE RULES:
- NEVER state Health or Fatigue as numbers/percentages in dialogue.
- Describe physical state naturally.

TIMEKEEPING FORMAT:
- Prepend or append messages with [SOL ${currentSol} :: LUNAR TIME HH:MM LST].

JSON RESPONSE SCHEMA:
Strictly respond with valid JSON:
{
  "reply": "Alex's dialogue text containing mission update...",
  "shouldAdvanceSol": false,
  "nextLunarTime": "14:30 LST",
  "telemetry": {
    "PWR": "65%",
    "BATT": "70%",
    "O2": "92%",
    "H2O": "85%",
    "FOOD": "78%",
    "RAD": "14%",
    "HEALTH": "96%",
    "FATIGUE": "25%"
  },
  "nasaAlert": "Short 1-line summary of live NASA status"
}
`.trim();

  const formattedContents = history.map(item => ({
    role: item.role === 'model' || item.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: item.parts?.[0]?.text || item.text || '' }]
  }));

  formattedContents.push({
    role: 'user',
    parts: [{ text: message || "[SYSTEM AUTOMATED PING :: REQUEST STATUS UPDATE]" }]
  });

  const models = [
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite'
  ];

  let lastError = null;

  for (const model of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{
