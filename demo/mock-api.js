/*
 * RecompTrack clickable demo — an in-browser stand-in for the API.
 * It intercepts fetch() calls to /api/* and answers from sample data held in memory.
 * Nothing leaves the browser; refreshing the page resets everything.
 */
(function () {
  "use strict";
  var DAY = 86400000;
  var now = Date.now();
  var iso = function (t) { return new Date(t).toISOString(); };
  var dateOf = function (t) { return new Date(t).toISOString().slice(0, 10); };
  var today = dateOf(now);
  var addDays = function (d, n) { var x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  var weekStart = function (d) { var x = new Date(d + "T12:00:00Z"); return addDays(d, -((x.getUTCDay() + 6) % 7)); };
  var r1 = function (n) { return Math.round(n * 10) / 10; };
  var seq = 1000;
  var id = function () { seq += 1; return ("000000000000000000000000" + seq.toString(16)).slice(-24); };
  var N = function (c, p, cb, f, fi) { return { calories: c, protein: p, carbohydrates: cb, fat: f, fibre: fi || 0, sugar: null, saturatedFat: null, sodiumMg: null }; };
  var scale = function (n, basis, q) { var k = q / basis; return N(r1(n.calories * k), r1(n.protein * k), r1(n.carbohydrates * k), r1(n.fat * k), r1(n.fibre * k)); };
  var sum = function (list) { return list.reduce(function (a, n) { return N(r1(a.calories + n.calories), r1(a.protein + n.protein), r1(a.carbohydrates + n.carbohydrates), r1(a.fat + n.fat), r1(a.fibre + n.fibre)); }, N(0, 0, 0, 0, 0)); };
  var e1rm = function (w, reps) { return reps <= 0 || w <= 0 ? 0 : reps === 1 ? w : r1(w * (1 + Math.min(reps, 12) / 30)); };
  var page = function (items, q) { var p = Number(q.get("page") || 1), l = Number(q.get("limit") || 20); return { items: items.slice((p - 1) * l, p * l), page: p, limit: l, total: items.length, totalPages: Math.max(1, Math.ceil(items.length / l)) }; };
  var match = function (s, q) { return !q || s.toLowerCase().indexOf(q.toLowerCase()) >= 0; };

  // ---- Lookups, exercises, foods -----------------------------------------
  var lk = function (name) { return { id: id(), name: name, slug: name.toLowerCase().replace(/[^a-z]+/g, "-"), description: null, status: "ACTIVE" }; };
  var muscles = ["Chest", "Back", "Lats", "Shoulders", "Biceps", "Triceps", "Quadriceps", "Hamstrings", "Glutes", "Core"].map(lk);
  var equipment = ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight"].map(lk);
  var M = function (n) { return muscles.filter(function (m) { return m.name === n; })[0]; };
  var E = function (n) { return equipment.filter(function (m) { return m.name === n; })[0]; };
  var ex = function (code, name, prim, sec, eq, type, pattern, sets, a, b, rest, instr) {
    return { id: id(), code: code, name: name, primaryMuscle: M(prim), secondaryMuscles: sec.map(M), equipment: E(eq), exerciseType: type, movementPattern: pattern, instructions: instr || [], mediaUrl: null, defaultSets: sets, defaultRepMin: a, defaultRepMax: b, defaultRestSeconds: rest, notes: null, status: "ACTIVE", createdAt: iso(now - 90 * DAY), updatedAt: iso(now - 90 * DAY) };
  };
  var exercises = [
    ex("CHEST001", "Bench Press", "Chest", ["Triceps", "Shoulders"], "Barbell", "COMPOUND", "HORIZONTAL_PUSH", 3, 8, 10, 120, ["Lie on the bench with eyes under the bar", "Grip slightly wider than shoulder width", "Lower the bar to mid-chest under control", "Press up until arms are straight"]),
    ex("BACK001", "Lat Pulldown", "Lats", ["Biceps"], "Cable", "COMPOUND", "VERTICAL_PULL", 3, 10, 12, 90),
    ex("BACK002", "Seated Cable Row", "Back", ["Biceps", "Lats"], "Cable", "COMPOUND", "HORIZONTAL_PULL", 3, 10, 12, 90),
    ex("LEGS001", "Leg Press", "Quadriceps", ["Glutes"], "Machine", "COMPOUND", "SQUAT", 3, 8, 12, 120),
    ex("LEGS002", "Romanian Deadlift", "Hamstrings", ["Glutes", "Back"], "Barbell", "COMPOUND", "HINGE", 3, 8, 10, 120),
    ex("CHEST002", "Incline Dumbbell Press", "Chest", ["Shoulders", "Triceps"], "Dumbbell", "COMPOUND", "HORIZONTAL_PUSH", 3, 8, 12, 90),
    ex("SHLD001", "Overhead Press", "Shoulders", ["Triceps"], "Barbell", "COMPOUND", "VERTICAL_PUSH", 3, 6, 10, 120),
    ex("ARMS001", "Dumbbell Curl", "Biceps", [], "Dumbbell", "ISOLATION", "ISOLATION", 3, 10, 15, 60),
  ];
  var X = function (code) { return exercises.filter(function (e) { return e.code === code; })[0]; };
  var food = function (name, cat, prep, n, sizes, brand) {
    return { id: id(), name: name, kind: brand ? "BRANDED" : "GENERIC", brand: brand || null, barcode: null, category: cat, preparation: prep, servingBasis: 100, servingUnit: "GRAM", servingSizes: sizes || [], nutrition: n, source: "REFERENCE_DATA", sourceReference: null, status: "ACTIVE", createdAt: iso(now - 90 * DAY), updatedAt: iso(now - 90 * DAY) };
  };
  var foods = [
    food("Chicken breast", "POULTRY", "COOKED", N(165, 31, 0, 3.6, 0)),
    food("Chicken breast", "POULTRY", "RAW", N(120, 22.5, 0, 2.6, 0)),
    food("White rice", "GRAINS", "COOKED", N(130, 2.7, 28.2, 0.3, 0.4)),
    food("Whole egg", "EGGS", "RAW", N(143, 12.6, 0.7, 9.5, 0), [{ label: "1 large egg", quantity: 50 }]),
    food("Rolled oats", "GRAINS", "RAW", N(379, 13.2, 67.7, 6.5, 10.1)),
    food("Broccoli", "VEGETABLES", "RAW", N(34, 2.8, 6.6, 0.4, 2.6)),
    food("Banana", "FRUITS", "RAW", N(89, 1.1, 22.8, 0.3, 2.6), [{ label: "1 medium", quantity: 118 }]),
    food("Paneer", "DAIRY", "RAW", N(296, 18.9, 6.1, 21.4, 0)),
    food("Greek yoghurt 0%", "DAIRY", "AS_PACKAGED", N(57, 10.3, 3.6, 0.2, 0), [{ label: "1 pot", quantity: 170 }], "Fage"),
  ];
  var F = function (name, prep) { return foods.filter(function (f) { return f.name === name && (!prep || f.preparation === prep); })[0]; };

  // ---- Users -------------------------------------------------------------
  var mkUser = function (name, email, role, daysAgo) { return { id: id(), name: name, email: email, role: role, status: "ACTIVE", onboardingCompleted: true, createdAt: iso(now - daysAgo * DAY), lastLoginAt: iso(now - (daysAgo % 5) * DAY) }; };
  var admin = mkUser("Super Admin", "admin@recomptrack.demo", "ADMIN", 120);
  var ann = mkUser("Ann Lee", "ann@example.com", "USER", 75);
  var users = [admin, ann, mkUser("Ravi Kumar", "ravi@example.com", "USER", 40), mkUser("Maya Chen", "maya@example.com", "USER", 33), mkUser("Tom Baker", "tom@example.com", "USER", 21), mkUser("Priya Shah", "priya@example.com", "USER", 9), mkUser("Leo Rossi", "leo@example.com", "USER", 2)];
  users[4].status = "DEACTIVATED";
  var sharing = {}; users.forEach(function (u) { sharing[u.id] = { shareProgressWithAdmin: false, shareNutritionWithAdmin: false }; });
  sharing[ann.id] = { shareProgressWithAdmin: true, shareNutritionWithAdmin: true };
  var me = {
    profile: { dateOfBirth: "1992-03-10", heightCm: 168, sex: "FEMALE", activityLevel: "MODERATE", trainingExperience: "BEGINNER", updatedAt: iso(now - 75 * DAY) },
    goal: { id: id(), goalType: "RECOMPOSITION", targetWeightKg: 68, targetBodyFatPercent: null, startDate: iso(now - 75 * DAY), endDate: null, status: "ACTIVE" },
    preferences: { units: "METRIC", timezone: "UTC", notifications: { workoutReminders: true, weighInReminders: true, mealReminders: false }, sharing: sharing[ann.id] },
  };
  var target = { calories: 1980, protein: 140, carbohydrates: 205, fat: 62, fibre: 28, method: "CALCULATED", effectiveFrom: iso(now - 20 * DAY), note: null, breakdown: { bmr: 1436, maintenance: 2226, adjustmentPercent: -10, age: 34, weightKg: 72.6, flooredToMinimum: false } };
  var targetSettings = {
    equation: "MIFFLIN_ST_JEOR",
    activityMultipliers: { SEDENTARY: 1.2, LIGHT: 1.375, MODERATE: 1.55, ACTIVE: 1.725, VERY_ACTIVE: 1.9 },
    goalCalorieAdjustmentPercent: { FAT_LOSS: -20, MUSCLE_GAIN: 10, RECOMPOSITION: -10 },
    proteinGPerKg: { FAT_LOSS: 2.0, MUSCLE_GAIN: 1.8, RECOMPOSITION: 2.0 },
    fatMinGPerKg: 0.6, fatPercentOfCalories: 25, fibreGPer1000Kcal: 14, minimumCalories: { FEMALE: 1200, MALE: 1500 }, reviewIntervalWeeks: 3,
  };

  // ---- Plans -------------------------------------------------------------
  var pe = function (code, sets, a, b, rest, order) { var e = X(code); return { exerciseId: e.id, exerciseName: e.name, primaryMuscle: e.primaryMuscle.name, equipment: e.equipment.name, order: order, sets: sets, repMin: a, repMax: b, restSeconds: rest, notes: null }; };
  var planId = id();
  var plans = [{
    id: planId, planKey: "upper-lower", version: 1, isLatest: true, name: "Upper / Lower – 4 Days", description: "Four-day upper/lower split for recomposition.",
    goalType: "RECOMPOSITION", experienceLevel: "BEGINNER", durationWeeks: 8, daysPerWeek: 4, status: "PUBLISHED", publishedAt: iso(now - 70 * DAY), createdAt: iso(now - 72 * DAY), updatedAt: iso(now - 70 * DAY),
    warmUpInstructions: "5 minutes easy cardio, then 2 light sets of the first exercise.",
    days: [
      { id: id(), dayNumber: 1, weekday: null, dayName: "Upper A", exercises: [pe("CHEST001", 3, 8, 10, 120, 1), pe("BACK001", 3, 10, 12, 90, 2), pe("BACK002", 3, 10, 12, 90, 3)] },
      { id: id(), dayNumber: 2, weekday: null, dayName: "Lower A", exercises: [pe("LEGS001", 3, 8, 12, 120, 1), pe("LEGS002", 3, 8, 10, 120, 2)] },
      { id: id(), dayNumber: 3, weekday: null, dayName: "Upper B", exercises: [pe("CHEST002", 3, 8, 12, 90, 1), pe("SHLD001", 3, 6, 10, 120, 2), pe("ARMS001", 3, 10, 15, 60, 3)] },
      { id: id(), dayNumber: 4, weekday: null, dayName: "Lower B", exercises: [pe("LEGS002", 3, 8, 10, 120, 1), pe("LEGS001", 3, 10, 12, 90, 2)] },
    ],
  }];
  plans.forEach(function (p) { p.versions = [{ id: p.id, version: p.version, status: p.status, publishedAt: p.publishedAt }]; });
  var assignment = { id: id(), userId: ann.id, workoutPlanId: planId, planName: plans[0].name, planVersion: 1, latestPublishedVersion: 1, startDate: iso(now - 60 * DAY), endDate: null, status: "ACTIVE", createdAt: iso(now - 60 * DAY) };
  var assignments = [assignment];

  // ---- Workout history (Ann): ~3 sessions a week for 8 weeks -------------
  var sessions = [];
  var startW = { CHEST001: 37.5, BACK001: 35, BACK002: 35, LEGS001: 90, LEGS002: 40, CHEST002: 12, SHLD001: 22.5, ARMS001: 8 };
  var dayIdx = 0;
  for (var d = 56; d >= 1; d -= (d % 3 === 0 ? 3 : 2)) {
    var day = plans[0].days[dayIdx % 4]; dayIdx++;
    var t = now - d * DAY + 18 * 3600000;
    var progress = (56 - d) / 56;
    var logs = day.exercises.map(function (p, i) {
      var w = Math.round((startW[X(exercises.filter(function (e) { return e.id === p.exerciseId; })[0].code).code] * (1 + 0.18 * progress)) * 2) / 2;
      return { id: id(), exerciseId: p.exerciseId, exerciseName: p.exerciseName, order: i + 1, planned: { sets: p.sets, repMin: p.repMin, repMax: p.repMax, restSeconds: p.restSeconds }, previous: null,
        sets: [0, 1, 2].map(function (k) { return { setNumber: k + 1, weightKg: w, reps: p.repMax - k, setType: "WORKING", completed: true, rpe: null }; }), notes: null, discomfort: { reported: false, location: null, severity: null, notes: null } };
    });
    sessions.push({ id: id(), title: day.dayName, workoutPlanId: planId, workoutPlanDayId: day.id, startedAt: iso(t - 3200000), completedAt: iso(t), pausedAt: null, pausedSeconds: 0, status: "COMPLETED", notes: null, summary: null, exercises: logs, userId: ann.id });
  }
  var summarise = function (s, prior) {
    var sets = 0, reps = 0, vol = 0, prs = [];
    s.exercises.forEach(function (l) {
      var best = 0, heavy = 0;
      l.sets.forEach(function (x) { if (x.completed && x.setType !== "WARM_UP" && x.reps > 0) { sets++; reps += x.reps; vol += (x.weightKg || 0) * x.reps; heavy = Math.max(heavy, x.weightKg || 0); best = Math.max(best, e1rm(x.weightKg || 0, x.reps)); } });
      var prevHeavy = 0;
      prior.forEach(function (ps) { ps.exercises.forEach(function (pl) { if (pl.exerciseId === l.exerciseId) pl.sets.forEach(function (x) { if (x.completed) prevHeavy = Math.max(prevHeavy, x.weightKg || 0); }); }); });
      if (prevHeavy && heavy > prevHeavy) prs.push({ exerciseId: l.exerciseId, exerciseName: l.exerciseName, kind: "HEAVIEST_WEIGHT", value: heavy, previous: prevHeavy });
    });
    var dur = Math.round((Date.parse(s.completedAt) - Date.parse(s.startedAt)) / 1000) - s.pausedSeconds;
    return { durationSeconds: dur, exercises: s.exercises.length, workingSets: sets, reps: reps, volumeKg: r1(vol), personalRecords: prs };
  };
  sessions.forEach(function (s, i) { s.summary = summarise(s, sessions.slice(0, i)); });
  var activeSession = null;

  // ---- Measurements & diary (Ann) ----------------------------------------
  var measurements = [];
  for (var md = 62; md >= 0; md--) {
    if (md % 7 === 3 || md % 11 === 5) continue; // realistic gaps
    var wgt = r1(74.6 - (62 - md) * 0.033 + Math.sin(md * 1.7) * 0.35);
    var m = { weightKg: wgt };
    if (md % 7 === 0) m.waistCm = r1(84.5 - (62 - md) * 0.055);
    measurements.push({ id: id(), recordedAt: iso(now - md * DAY - 2 * 3600000), measurements: m, source: "MANUAL", notes: null });
  }
  var logs = [];
  var addLog = function (date, meal, f, q) {
    var l = { id: id(), localDate: date, mealType: meal, quantity: q, unit: "g", food: { id: f.id, customFoodId: null, name: f.name, brand: f.brand, preparation: f.preparation }, mealTemplateId: null, nutrition: scale(f.nutrition, f.servingBasis, q), basis: f.nutrition, basisQty: f.servingBasis, loggedAt: iso(Date.parse(date + "T12:00:00Z")) };
    logs.push(l); return l;
  };
  for (var nd = 13; nd >= 0; nd--) {
    var dt = addDays(today, -nd);
    if (nd === 9 || nd === 4) continue; // days not logged
    addLog(dt, "BREAKFAST", F("Rolled oats"), 60); addLog(dt, "BREAKFAST", F("Banana"), 118);
    addLog(dt, "LUNCH", F("Chicken breast", "COOKED"), 150 + (nd % 3) * 20); addLog(dt, "LUNCH", F("White rice"), 200);
    if (nd > 0) { addLog(dt, "DINNER", F("Paneer"), 120); addLog(dt, "DINNER", F("Broccoli"), 150); addLog(dt, "SNACK", F("Greek yoghurt 0%"), 170); }
  }
  var customFoods = [];
  var savedMeals = [];
  var mealTemplate = { id: id(), name: "Chicken and rice lunch", description: "High-protein lunch", mealType: "LUNCH", tags: ["high-protein"], status: "PUBLISHED", activeAssignments: 1, createdAt: iso(now - 50 * DAY), updatedAt: iso(now - 50 * DAY),
    ingredients: [[F("Chicken breast", "COOKED"), 150], [F("White rice"), 200], [F("Broccoli"), 100]].map(function (p) { return { foodId: p[0].id, name: p[0].name, brand: null, preparation: p[0].preparation, quantity: p[1], unit: "g", nutrition: scale(p[0].nutrition, 100, p[1]), foodStatus: "ACTIVE" }; }) };
  mealTemplate.totalNutrition = sum(mealTemplate.ingredients.map(function (i) { return i.nutrition; }));
  var mealTemplates = [mealTemplate];
  var mealAssignments = [{ id: id(), mealTemplate: mealTemplate, startDate: iso(now - 40 * DAY), endDate: null, status: "ACTIVE" }];

  var audit = [];
  var logAudit = function (action, type, entityId, summary) { audit.unshift({ id: id(), actor: { id: admin.id, name: admin.name, email: admin.email }, action: action, entityType: type, entityId: entityId, summary: summary, changes: null, createdAt: iso(Date.now()) }); };
  logAudit("WORKOUT_PLAN_PUBLISHED", "WORKOUT_PLAN", planId, "Published Upper / Lower – 4 Days v1");
  logAudit("WORKOUT_PLAN_ASSIGNED", "USER", ann.id, "Assigned Upper / Lower – 4 Days v1 to ann@example.com");
  logAudit("FOOD_CREATED", "FOOD", foods[8].id, "Created food Greek yoghurt 0% (Fage)");

  // ---- Derived views -----------------------------------------------------
  var diary = function (date) {
    date = date || today;
    var dayLogs = logs.filter(function (l) { return l.localDate === date; });
    var meals = {};
    ["BREAKFAST", "LUNCH", "DINNER", "SNACK"].forEach(function (m) { var e = dayLogs.filter(function (l) { return l.mealType === m; }); meals[m] = { entries: e, totals: sum(e.map(function (l) { return l.nutrition; })) }; });
    return { date: date, meals: meals, totals: sum(dayLogs.map(function (l) { return l.nutrition; })), target: target };
  };
  var weightPts = function () { return measurements.filter(function (m) { return typeof m.measurements.weightKg === "number"; }).map(function (m) { return { date: dateOf(Date.parse(m.recordedAt)), value: m.measurements.weightKg }; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }); };
  var bodyTrend = function (days) {
    var from = addDays(today, -(days - 1));
    var pts = weightPts();
    var byDay = {}; pts.forEach(function (p) { (byDay[p.date] = byDay[p.date] || []).push(p.value); });
    var daily = Object.keys(byDay).sort().map(function (d) { var v = byDay[d]; return { date: d, value: r1(v.reduce(function (a, b) { return a + b; }, 0) / v.length) }; });
    var weight = daily.map(function (p) {
      var win = daily.filter(function (q) { return q.date <= p.date && (Date.parse(p.date) - Date.parse(q.date)) < 7 * DAY; });
      return { date: p.date, valueKg: p.value, average7d: Math.round(win.reduce(function (a, q) { return a + q.value; }, 0) / win.length * 100) / 100 };
    }).filter(function (p) { return p.date >= from; });
    var xs = weight.map(function (p) { return (Date.parse(p.date) - Date.parse(weight[0].date)) / DAY; }), ys = weight.map(function (p) { return p.valueKg; });
    var mx = xs.reduce(function (a, b) { return a + b; }, 0) / (xs.length || 1), my = ys.reduce(function (a, b) { return a + b; }, 0) / (ys.length || 1);
    var den = xs.reduce(function (a, x) { return a + (x - mx) * (x - mx); }, 0);
    var slope = den ? xs.reduce(function (a, x, i) { return a + (x - mx) * (ys[i] - my); }, 0) / den : null;
    var waist = measurements.filter(function (m) { return typeof m.measurements.waistCm === "number"; }).map(function (m) { return { date: dateOf(Date.parse(m.recordedAt)), valueCm: m.measurements.waistCm }; }).filter(function (p) { return p.date >= from; });
    return { range: { from: from, to: today }, weight: weight, waist: waist, weeklyRateKg: slope === null ? null : Math.round(slope * 7 * 100) / 100, goalType: me.goal.goalType, targetWeightKg: me.goal.targetWeightKg };
  };
  var completed = function () { return sessions.filter(function (s) { return s.status === "COMPLETED"; }); };
  var strengthPoints = function (exerciseId) {
    return completed().map(function (s) {
      var best = 0, heavy = 0, vol = 0, n = 0;
      s.exercises.forEach(function (l) { if (l.exerciseId !== exerciseId) return; l.sets.forEach(function (x) { if (x.completed && x.setType !== "WARM_UP" && x.reps > 0) { n++; vol += x.weightKg * x.reps; heavy = Math.max(heavy, x.weightKg); best = Math.max(best, e1rm(x.weightKg, x.reps)); } }); });
      return n ? { date: dateOf(Date.parse(s.completedAt)), sessionId: s.id, bestOneRepMax: best, heaviestKg: heavy, volumeKg: r1(vol), workingSets: n } : null;
    }).filter(Boolean);
  };
  var strengthSummary = function () {
    var ids = {}; completed().forEach(function (s) { s.exercises.forEach(function (l) { ids[l.exerciseId] = l.exerciseName; }); });
    return Object.keys(ids).map(function (k) {
      var p = strengthPoints(k);
      return p.length ? { exerciseId: k, exerciseName: ids[k], sessions: p.length, lastPerformedAt: completed().filter(function (s) { return s.id === p[p.length - 1].sessionId; })[0].completedAt, bestOneRepMax: Math.max.apply(null, p.map(function (x) { return x.bestOneRepMax; })), latestOneRepMax: p[p.length - 1].bestOneRepMax, firstOneRepMax: p[0].bestOneRepMax } : null;
    }).filter(Boolean).sort(function (a, b) { return a.lastPerformedAt < b.lastPerformedAt ? 1 : -1; });
  };
  var trainingWeeks = function (weeks) {
    var first = addDays(weekStart(today), -7 * (weeks - 1));
    var out = []; for (var i = 0; i < weeks; i++) out.push({ weekStart: addDays(first, 7 * i), sessions: 0, workingSets: 0, volumeKg: 0, durationMinutes: 0 });
    completed().forEach(function (s) { var w = out.filter(function (o) { return o.weekStart === weekStart(dateOf(Date.parse(s.completedAt))); })[0]; if (!w) return; w.sessions++; w.workingSets += s.summary.workingSets; w.volumeKg = Math.round(w.volumeKg + s.summary.volumeKg); w.durationMinutes += Math.round(s.summary.durationSeconds / 60); });
    return out;
  };
  var weekly = function (any) {
    var ws = weekStart(any || today), we = addDays(ws, 6), prev = addDays(ws, -7);
    var days = []; for (var i = 0; i < 7; i++) { var dd = addDays(ws, i); var dl = logs.filter(function (l) { return l.localDate === dd; }); var t = sum(dl.map(function (l) { return l.nutrition; })); days.push({ date: dd, entries: dl.length, calories: Math.round(t.calories), protein: Math.round(t.protein), c: t }); }
    var logged = days.filter(function (d) { return d.entries; });
    var avg = function (k) { return logged.length ? Math.round(logged.reduce(function (a, d) { return a + d.c[k]; }, 0) / logged.length) : null; };
    var ses = completed().filter(function (s) { var d = dateOf(Date.parse(s.completedAt)); return d >= ws && d <= we; });
    var wIn = function (a, b) { return weightPts().filter(function (p) { return p.date >= a && p.date <= b; }).map(function (p) { return p.value; }); };
    var mean = function (xs) { return xs.length ? Math.round(xs.reduce(function (a, b) { return a + b; }, 0) / xs.length * 100) / 100 : null; };
    var tw = wIn(ws, we), pw = wIn(prev, addDays(ws, -1)), aw = mean(tw), pa = mean(pw);
    var prs = []; ses.forEach(function (s) { s.summary.personalRecords.forEach(function (p) { prs.push({ exerciseName: p.exerciseName, kind: p.kind, value: p.value }); }); });
    var recos = [];
    if (logged.length < 5) recos.push({ kind: "LOGGING", tone: "neutral", text: "Food was logged on " + logged.length + " of 7 days. Logging at least 5 days makes the averages reliable." });
    else if (avg("protein") < target.protein * 0.9) recos.push({ kind: "NUTRITION", tone: "attention", text: "Protein averaged " + avg("protein") + " g against a " + target.protein + " g target. Adding a protein source to one more meal usually closes the gap." });
    else recos.push({ kind: "PRAISE", tone: "positive", text: "Protein averaged " + avg("protein") + " g — on target." });
    recos.push(ses.length >= 4 ? { kind: "PRAISE", tone: "positive", text: "All 4 planned workouts done." } : { kind: "TRAINING", tone: ses.length ? "neutral" : "attention", text: ses.length + " of 4 planned workouts completed." });
    if (prs.length) recos.push({ kind: "PRAISE", tone: "positive", text: prs.length + " personal record" + (prs.length > 1 ? "s" : "") + " this week." });
    if (tw.length < 3) recos.push({ kind: "LOGGING", tone: "neutral", text: tw.length + " weigh-ins this week. Three or more morning weigh-ins give a clearer trend." });
    else if (aw !== null && pa !== null) { var ch = r1(aw - pa); var pct = Math.round(((aw - pa) / pa) * 10000) / 100; recos.push({ kind: "BODY", tone: pct >= -0.5 && pct <= 0.25 ? "positive" : "attention", text: "Average weight " + (ch >= 0 ? "+" : "") + ch + " kg vs last week (" + pct + "%)." + (pct >= -0.5 && pct <= 0.25 ? " In the expected range for your goal." : " Worth watching next week.") }); }
    return { weekStart: ws, weekEnd: we, goalType: me.goal.goalType,
      nutrition: { daysLogged: logged.length, avgCalories: avg("calories"), avgProtein: avg("protein"), avgCarbohydrates: avg("carbohydrates"), avgFat: avg("fat"), avgFibre: avg("fibre"), target: { calories: target.calories, protein: target.protein }, days: days.map(function (d) { return { date: d.date, entries: d.entries, calories: d.calories, protein: d.protein }; }) },
      training: { sessions: ses.length, plannedPerWeek: 4, workingSets: ses.reduce(function (a, s) { return a + s.summary.workingSets; }, 0), volumeKg: Math.round(ses.reduce(function (a, s) { return a + s.summary.volumeKg; }, 0)), durationMinutes: ses.reduce(function (a, s) { return a + Math.round(s.summary.durationSeconds / 60); }, 0), personalRecords: prs, discomfortReports: 0 },
      body: { weighIns: tw.length, avgWeightKg: aw, prevAvgWeightKg: pa, changeKg: aw !== null && pa !== null ? r1(aw - pa) : null, latestWaistCm: null, waistChangeCm: null },
      recommendations: recos };
  };
  var nextDay = function () {
    var last = completed().filter(function (s) { return s.workoutPlanDayId; }).slice(-1)[0];
    var days = plans[0].days;
    var idx = last ? days.map(function (d) { return d.id; }).indexOf(last.workoutPlanDayId) : -1;
    var doneToday = last && dateOf(Date.parse(last.completedAt)) === today;
    return { assignmentId: assignment.id, day: doneToday ? days[idx] : days[(idx + 1) % days.length], reason: doneToday ? "DONE_TODAY" : "ROTATION", startsOn: dateOf(Date.parse(assignment.startDate)), activeSessionId: activeSession ? activeSession.id : null };
  };
  var lastWeights = function (exerciseId) {
    var prev = completed().slice().reverse().map(function (s) { return s.exercises.filter(function (l) { return l.exerciseId === exerciseId; })[0]; }).filter(Boolean)[0];
    return prev ? prev.sets.filter(function (s) { return s.completed; }).map(function (s) { return { weightKg: s.weightKg, reps: s.reps }; }) : null;
  };
  var withPrevious = function (s) { if (s.status !== "COMPLETED") s.exercises.forEach(function (l) { l.previous = lastWeights(l.exerciseId); }); return s; };
  var dashboard = function () {
    var members = users.filter(function (u) { return u.role === "USER"; });
    return { range: { from: iso(now - 7 * DAY), to: iso(now) },
      users: { total: members.length, active: members.filter(function (u) { return u.status === "ACTIVE"; }).length, deactivated: members.filter(function (u) { return u.status !== "ACTIVE"; }).length, newInRange: 2, activeInRange: 5 },
      catalogue: { exercises: exercises.filter(function (e) { return e.status === "ACTIVE"; }).length, archivedExercises: exercises.filter(function (e) { return e.status !== "ACTIVE"; }).length, foods: foods.filter(function (f) { return f.status === "ACTIVE"; }).length, archivedFoods: foods.filter(function (f) { return f.status !== "ACTIVE"; }).length },
      plans: { activeWorkoutPlans: plans.filter(function (p) { return p.status === "PUBLISHED"; }).length },
      activity: { workoutSessionsInRange: completed().filter(function (s) { return Date.parse(s.completedAt) > now - 7 * DAY; }).length + 9, foodLogsInRange: 112, measurementsInRange: 31 },
      latestRegistrations: members.slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; }).slice(0, 5).map(function (u) { return { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt }; }),
      latestAdminChanges: audit.slice(0, 6) };
  };
  var analytics = function (weeks) {
    var first = addDays(weekStart(today), -7 * (weeks - 1)), out = [];
    for (var i = 0; i < weeks; i++) { var b = Math.round(9 + i * 1.6 + Math.sin(i) * 2); out.push({ weekStart: addDays(first, 7 * i), newUsers: [2, 1, 3, 1, 2, 0, 3, 2, 1, 2, 1, 2][i % 12], activeUsers: b, workoutsCompleted: b * 3 - 4, foodLogEntries: b * 21, measurementEntries: b * 3 }); }
    return { weeks: out, topExercises: exercises.slice(0, 5).map(function (e, i) { return { exerciseId: e.id, exerciseName: e.name, sessions: 96 - i * 11, users: 6 - Math.floor(i / 2) }; }),
      planAdoption: [{ planName: "Upper / Lower – 4 Days v1", activeAssignments: assignments.filter(function (a) { return a.status === "ACTIVE"; }).length + 3 }],
      totals: { members: users.filter(function (u) { return u.role === "USER" && u.status === "ACTIVE"; }).length, membersWithPlan: 4, membersLoggingFoodThisWeek: 4, membersTrainingThisWeek: 3 } };
  };
  var meDTO = function () { return { user: ann, profile: me.profile, goal: me.goal, preferences: me.preferences, permissions: [] }; };
  var exStatus = function (list, q) { var st = q.get("status") || "ACTIVE"; return list.filter(function (x) { return st === "ALL" || x.status === st; }); };

  // ---- Routes ------------------------------------------------------------
  var routes = [];
  var on = function (method, pattern, fn) { routes.push({ method: method, re: new RegExp("^" + pattern.replace(/:\w+/g, "([^/]+)") + "$"), fn: fn }); };
  var err = function (status, code, message) { var e = new Error(message); e.status = status; e.body = { error: { code: code, message: message } }; throw e; };
  var who = null; // signed-in user for this app instance
  var auth = function (u) { who = u; return { user: u, accessToken: "demo", accessTokenExpiresIn: 900, refreshToken: "demo-refresh-token-0000000000000000" }; };

  on("POST", "/auth/login", function (b) { return auth(location.pathname.indexOf("admin") >= 0 || (b.email || "").indexOf("admin") === 0 || b.clientType === "web" ? admin : ann); });
  on("POST", "/auth/register", function (b) { ann.name = b.name || ann.name; return auth(ann); });
  on("POST", "/auth/refresh", function () { if (!who) err(401, "REFRESH_INVALID", "Session expired"); return auth(who); });
  on("POST", "/auth/logout", function () { who = null; return null; });
  on("POST", "/auth/forgot-password", function () { return { message: "If that email is registered, a reset link has been sent." }; });

  on("GET", "/users/me", function () { return meDTO(); });
  on("PATCH", "/users/me/preferences", function (b) { if (b.sharing) Object.keys(b.sharing).forEach(function (k) { me.preferences.sharing[k] = b.sharing[k]; }); return meDTO(); });
  on("POST", "/users/me/assessment", function () { return meDTO(); });

  on("GET", "/measurements/summary", function () {
    var w = measurements.filter(function (m) { return m.measurements.weightKg; }); var last = w[w.length - 1];
    var week = w.filter(function (m) { return Date.parse(m.recordedAt) > Date.now() - 7 * DAY; }).map(function (m) { return m.measurements.weightKg; });
    var wa = measurements.filter(function (m) { return m.measurements.waistCm; }).slice(-1)[0];
    return { latestWeight: last ? { valueKg: last.measurements.weightKg, recordedAt: last.recordedAt } : null, weightSevenDayAverageKg: week.length ? r1(week.reduce(function (a, b) { return a + b; }, 0) / week.length) : null, weightEntriesLastSevenDays: week.length, latestWaist: wa ? { valueCm: wa.measurements.waistCm, recordedAt: wa.recordedAt } : null };
  });
  on("GET", "/measurements", function (b, q) { return page(measurements.slice().reverse(), q); });
  on("POST", "/measurements", function (b) { var m = { id: id(), recordedAt: iso(Date.now()), measurements: b.measurements, source: "MANUAL", notes: null }; measurements.push(m); return m; });

  on("GET", "/lookups/muscle-groups", function () { return muscles; });
  on("GET", "/lookups/equipment", function () { return equipment; });
  on("GET", "/exercises", function (b, q) { return page(exercises.filter(function (e) { return e.status === "ACTIVE" && match(e.name, q.get("q")) && (!q.get("muscleId") || e.primaryMuscle.id === q.get("muscleId") || e.secondaryMuscles.some(function (m) { return m.id === q.get("muscleId"); })); }), q); });
  on("GET", "/exercises/:id", function (b, q, p) { return exercises.filter(function (e) { return e.id === p[0]; })[0] || err(404, "NOT_FOUND", "Exercise not found"); });
  on("GET", "/foods", function (b, q) { return page(foods.filter(function (f) { return f.status === "ACTIVE" && (match(f.name, q.get("q")) || match(f.brand || "", q.get("q"))); }), q); });
  on("GET", "/foods/:id", function (b, q, p) { return foods.filter(function (f) { return f.id === p[0]; })[0] || err(404, "NOT_FOUND", "Food not found"); });

  on("GET", "/nutrition/diary", function (b, q) { return diary(q.get("date")); });
  on("GET", "/nutrition/targets", function () { return { target: target, missing: [], reviewDue: false }; });
  on("GET", "/nutrition/history", function () { var out = []; for (var i = 6; i >= 0; i--) { var dd = addDays(today, -i); var dl = logs.filter(function (l) { return l.localDate === dd; }); out.push({ date: dd, entries: dl.length, totals: sum(dl.map(function (l) { return l.nutrition; })) }); } return out; });
  on("GET", "/nutrition/recent-foods", function () { var seen = {}, out = []; logs.slice().reverse().forEach(function (l) { if (!seen[l.food.id] && out.length < 8) { seen[l.food.id] = 1; out.push({ foodId: l.food.id, customFoodId: null, name: l.food.name, brand: l.food.brand, lastQuantity: l.quantity, unit: "g" }); } }); return out; });
  on("GET", "/nutrition/custom-foods", function () { return customFoods; });
  on("POST", "/nutrition/custom-foods", function (b) { var c = { id: id(), name: b.name, brand: b.brand || null, servingBasis: b.servingBasis || 100, servingUnit: b.servingUnit || "GRAM", nutrition: N(b.nutrition.calories, b.nutrition.protein, b.nutrition.carbohydrates, b.nutrition.fat, b.nutrition.fibre), createdAt: iso(Date.now()) }; customFoods.push(c); return c; });
  on("DELETE", "/nutrition/custom-foods/:id", function (b, q, p) { customFoods = customFoods.filter(function (c) { return c.id !== p[0]; }); return null; });
  on("POST", "/nutrition/logs", function (b) {
    var f = b.foodId ? foods.filter(function (x) { return x.id === b.foodId; })[0] : customFoods.filter(function (x) { return x.id === b.customFoodId; })[0];
    if (!f) err(404, "NOT_FOUND", "Food not found");
    return addLog(b.localDate || today, b.mealType, f, b.quantity);
  });
  on("PATCH", "/nutrition/logs/:id", function (b, q, p) { var l = logs.filter(function (x) { return x.id === p[0]; })[0]; if (b.mealType) l.mealType = b.mealType; if (b.quantity) { l.quantity = b.quantity; l.nutrition = scale(l.basis, l.basisQty, b.quantity); } return l; });
  on("DELETE", "/nutrition/logs/:id", function (b, q, p) { logs = logs.filter(function (l) { return l.id !== p[0]; }); return null; });
  on("GET", "/nutrition/saved-meals", function () { return savedMeals; });
  on("POST", "/nutrition/saved-meals/from-diary", function (b) {
    var items = logs.filter(function (l) { return l.localDate === b.localDate && l.mealType === b.mealType; }).map(function (l) { return { foodId: l.food.id, customFoodId: null, name: l.food.name, quantity: l.quantity, unit: "g", nutrition: l.nutrition, available: true, basis: l.basis }; });
    var s = { id: id(), name: b.name, items: items, totals: sum(items.map(function (i) { return i.nutrition; })), createdAt: iso(Date.now()) }; savedMeals.push(s); return s;
  });
  on("DELETE", "/nutrition/saved-meals/:id", function (b, q, p) { savedMeals = savedMeals.filter(function (s) { return s.id !== p[0]; }); return null; });
  on("POST", "/nutrition/saved-meals/:id/log", function (b, q, p) { var s = savedMeals.filter(function (x) { return x.id === p[0]; })[0]; s.items.forEach(function (i) { var f = foods.filter(function (x) { return x.id === i.foodId; })[0]; if (f) addLog(b.localDate || today, b.mealType, f, i.quantity); }); return { logged: s.items.length, skipped: 0 }; });
  on("GET", "/nutrition/meal-plans", function () { return mealAssignments; });
  on("POST", "/nutrition/meal-plans/:id/log", function (b) { mealTemplate.ingredients.forEach(function (i) { addLog(b.localDate || today, b.mealType, foods.filter(function (f) { return f.id === i.foodId; })[0], i.quantity * (b.portion || 1)); }); return { logged: mealTemplate.ingredients.length, skipped: 0 }; });

  on("GET", "/workouts/today", function () { return nextDay(); });
  on("GET", "/workouts/plan", function () { return { assignment: assignment, plan: plans[0] }; });
  on("GET", "/workouts/sessions", function (b, q) { return page(completed().slice().reverse(), q); });
  on("GET", "/workouts/sessions/active", function () { return activeSession ? withPrevious(activeSession) : null; });
  on("GET", "/workouts/sessions/:id", function (b, q, p) { var s = sessions.filter(function (x) { return x.id === p[0]; })[0] || (activeSession && activeSession.id === p[0] ? activeSession : null); return s ? withPrevious(s) : err(404, "NOT_FOUND", "Workout not found"); });
  on("POST", "/workouts/sessions", function (b) {
    if (activeSession) err(409, "SESSION_IN_PROGRESS", "Finish or discard your current workout first");
    var day = b.workoutPlanDayId ? plans[0].days.filter(function (d) { return d.id === b.workoutPlanDayId; })[0] : null;
    activeSession = { id: id(), title: day ? day.dayName : "Free workout", workoutPlanId: day ? planId : null, workoutPlanDayId: day ? day.id : null, startedAt: iso(Date.now()), completedAt: null, pausedAt: null, pausedSeconds: 0, status: "IN_PROGRESS", notes: null, summary: null,
      exercises: (day ? day.exercises : []).map(function (p, i) { var prev = lastWeights(p.exerciseId); var w = prev ? Math.max.apply(null, prev.map(function (x) { return x.weightKg || 0; })) : null;
        return { id: id(), exerciseId: p.exerciseId, exerciseName: p.exerciseName, order: i + 1, planned: { sets: p.sets, repMin: p.repMin, repMax: p.repMax, restSeconds: p.restSeconds }, previous: prev, sets: [0, 1, 2].slice(0, p.sets).map(function (k) { return { setNumber: k + 1, weightKg: w, reps: null, setType: "WORKING", completed: false, rpe: null }; }), notes: null, discomfort: { reported: false, location: null, severity: null, notes: null } }; }) };
    return withPrevious(activeSession);
  });
  on("POST", "/workouts/sessions/:id/exercises", function (b) { var e = exercises.filter(function (x) { return x.id === b.exerciseId; })[0]; var prev = lastWeights(e.id);
    activeSession.exercises.push({ id: id(), exerciseId: e.id, exerciseName: e.name, order: activeSession.exercises.length + 1, planned: null, previous: prev, sets: [1, 2, 3].map(function (k) { return { setNumber: k, weightKg: prev ? prev[0].weightKg : null, reps: null, setType: "WORKING", completed: false, rpe: null }; }), notes: null, discomfort: { reported: false, location: null, severity: null, notes: null } });
    return withPrevious(activeSession); });
  on("PUT", "/workouts/sessions/:id/exercises/:logId", function (b, q, p) { var l = activeSession.exercises.filter(function (x) { return x.id === p[1]; })[0]; if (b.sets) l.sets = b.sets.map(function (s, i) { return Object.assign({ rpe: null }, s, { setNumber: i + 1 }); }); if ("notes" in b) l.notes = b.notes; if (b.discomfort) l.discomfort = Object.assign({ location: null, severity: null, notes: null }, b.discomfort); return l; });
  on("DELETE", "/workouts/sessions/:id/exercises/:logId", function (b, q, p) { activeSession.exercises = activeSession.exercises.filter(function (x) { return x.id !== p[1]; }); return withPrevious(activeSession); });
  on("POST", "/workouts/sessions/:id/pause", function () { activeSession.status = "PAUSED"; activeSession.pausedAt = iso(Date.now()); return withPrevious(activeSession); });
  on("POST", "/workouts/sessions/:id/resume", function () { activeSession.pausedSeconds += Math.round((Date.now() - Date.parse(activeSession.pausedAt)) / 1000); activeSession.pausedAt = null; activeSession.status = "IN_PROGRESS"; return withPrevious(activeSession); });
  on("POST", "/workouts/sessions/:id/discard", function () { activeSession = null; return null; });
  on("POST", "/workouts/sessions/:id/complete", function () {
    var s = activeSession;
    var done = s.exercises.some(function (l) { return l.sets.some(function (x) { return x.completed && x.setType !== "WARM_UP" && x.reps > 0; }); });
    if (!done) { var e = new Error("x"); e.status = 400; e.body = { error: { code: "VALIDATION_ERROR", message: "Some fields are invalid", details: [{ path: "sets", message: "Complete at least one set, or discard this workout" }] } }; throw e; }
    if (s.pausedAt) { s.pausedSeconds += Math.round((Date.now() - Date.parse(s.pausedAt)) / 1000); s.pausedAt = null; }
    s.status = "COMPLETED"; s.completedAt = iso(Date.now()); s.summary = summarise(s, completed()); s.exercises.forEach(function (l) { l.previous = null; });
    sessions.push(s); activeSession = null; return s;
  });

  on("GET", "/reports/body", function (b, q) { return bodyTrend(Number(q.get("days") || 90)); });
  on("GET", "/reports/strength", function () { return strengthSummary(); });
  on("GET", "/reports/strength/:id", function (b, q, p) { var pts = strengthPoints(p[0]); var e = exercises.filter(function (x) { return x.id === p[0]; })[0]; return { exerciseId: p[0], exerciseName: e ? e.name : "Exercise", points: pts }; });
  on("GET", "/reports/training", function (b, q) { return trainingWeeks(Number(q.get("weeks") || 8)); });
  on("GET", "/reports/weekly", function (b, q) { return weekly(q.get("week")); });

  // ---- Admin ---------------------------------------------------------------
  on("GET", "/admin/dashboard", function () { return dashboard(); });
  on("GET", "/admin/analytics", function (b, q) { return analytics(Number(q.get("weeks") || 12)); });
  on("GET", "/admin/audit-logs", function (b, q) { return page(audit.filter(function (a) { return (!q.get("entityType") || a.entityType === q.get("entityType")) && (!q.get("entityId") || a.entityId === q.get("entityId")); }), q); });
  on("GET", "/admin/users", function (b, q) { return page(users.filter(function (u) { return (match(u.name, q.get("q")) || match(u.email, q.get("q"))) && (!q.get("role") || u.role === q.get("role")) && (!q.get("status") || u.status === q.get("status")); }), q); });
  on("GET", "/admin/users/:id", function (b, q, p) { var u = users.filter(function (x) { return x.id === p[0]; })[0]; logAudit("USER_VIEWED", "USER", u.id, "Viewed account of " + u.email);
    return { user: u, profile: { activityLevel: "MODERATE", trainingExperience: "BEGINNER" }, goal: { goalType: "RECOMPOSITION", startDate: u.createdAt }, sharing: sharing[u.id] }; });
  on("PATCH", "/admin/users/:id", function (b, q, p) { var u = users.filter(function (x) { return x.id === p[0]; })[0]; if (b.status) u.status = b.status; if (b.role) u.role = b.role; logAudit(b.status === "DEACTIVATED" ? "USER_DEACTIVATED" : b.status ? "USER_ACTIVATED" : "USER_ROLE_CHANGED", "USER", u.id, "Updated " + u.email); return u; });
  on("GET", "/admin/users/:id/plans", function (b, q, p) { var a = assignments.filter(function (x) { return x.userId === p[0] && x.status === "ACTIVE"; })[0];
    return { workoutAssignment: a || null, workoutHistory: [], mealAssignments: p[0] === ann.id ? [{ id: mealAssignments[0].id, mealTemplateId: mealTemplate.id, name: mealTemplate.name, mealType: "LUNCH", startDate: mealAssignments[0].startDate, status: "ACTIVE" }] : [], target: p[0] === ann.id ? Object.assign({}, target, { breakdown: null }) : null }; });
  on("PUT", "/admin/users/:id/targets", function (b, q, p) { if (p[0] === ann.id) { target = Object.assign({}, target, b, { method: "MANUAL", effectiveFrom: iso(Date.now()) }); } logAudit("USER_TARGET_SET", "USER", p[0], "Set individual nutrition target (" + b.calories + " kcal)"); return routesGet("/admin/users/" + p[0] + "/plans"); });
  on("POST", "/admin/users/:id/targets/recalculate", function (b, q, p) { target.method = "CALCULATED"; target.note = null; return routesGet("/admin/users/" + p[0] + "/plans"); });
  on("GET", "/admin/users/:id/report", function (b, q, p) { var u = users.filter(function (x) { return x.id === p[0]; })[0]; var s = sharing[u.id];
    if (!s.shareProgressWithAdmin && !s.shareNutritionWithAdmin) err(403, "CONSENT_REQUIRED", "This member hasn't shared their progress or nutrition with admins");
    logAudit("USER_REPORT_VIEWED", "USER", u.id, "Viewed shared report of " + u.email);
    var r = weekly(q.get("week")); return { user: { id: u.id, name: u.name, email: u.email }, consent: { progress: s.shareProgressWithAdmin, nutrition: s.shareNutritionWithAdmin },
      report: { weekStart: r.weekStart, weekEnd: r.weekEnd, nutrition: s.shareNutritionWithAdmin ? r.nutrition : null, training: s.shareProgressWithAdmin ? r.training : null, body: s.shareProgressWithAdmin ? r.body : null }, bodyTrend: s.shareProgressWithAdmin ? bodyTrend(90) : null }; });

  on("GET", "/admin/exercises", function (b, q) { return page(exStatus(exercises, q).filter(function (e) { return match(e.name + " " + e.code, q.get("q")) && (!q.get("muscleId") || e.primaryMuscle.id === q.get("muscleId")) && (!q.get("exerciseType") || e.exerciseType === q.get("exerciseType")); }), q); });
  var lookupById = function (list, idv) { return list.filter(function (x) { return x.id === idv; })[0] || null; };
  var applyExercise = function (e, b) { ["code", "name", "exerciseType", "movementPattern", "instructions", "mediaUrl", "defaultSets", "defaultRepMin", "defaultRepMax", "defaultRestSeconds", "notes"].forEach(function (k) { if (k in b) e[k] = b[k]; }); if (b.primaryMuscleId) e.primaryMuscle = lookupById(muscles, b.primaryMuscleId); if (b.secondaryMuscleIds) e.secondaryMuscles = b.secondaryMuscleIds.map(function (m) { return lookupById(muscles, m); }).filter(Boolean); if ("equipmentId" in b) e.equipment = lookupById(equipment, b.equipmentId); e.code = (e.code || "").toUpperCase(); e.updatedAt = iso(Date.now()); return e; };
  on("POST", "/admin/exercises", function (b) { if (exercises.some(function (e) { return e.code === String(b.code).toUpperCase(); })) err(409, "DUPLICATE_CODE", "Exercise code " + b.code + " is already used"); var e = applyExercise({ id: id(), status: "ACTIVE", createdAt: iso(Date.now()), secondaryMuscles: [], equipment: null }, b); exercises.push(e); logAudit("EXERCISE_CREATED", "EXERCISE", e.id, "Created exercise " + e.code + " " + e.name); return e; });
  on("PATCH", "/admin/exercises/:id", function (b, q, p) { var e = lookupById(exercises, p[0]); applyExercise(e, b); logAudit("EXERCISE_UPDATED", "EXERCISE", e.id, "Updated exercise " + e.code); return e; });
  on("POST", "/admin/exercises/:id/archive", function (b, q, p) { var e = lookupById(exercises, p[0]); e.status = "ARCHIVED"; logAudit("EXERCISE_ARCHIVED", "EXERCISE", e.id, "Archived exercise " + e.code); return e; });
  on("POST", "/admin/exercises/:id/restore", function (b, q, p) { var e = lookupById(exercises, p[0]); e.status = "ACTIVE"; logAudit("EXERCISE_RESTORED", "EXERCISE", e.id, "Restored exercise " + e.code); return e; });
  on("DELETE", "/admin/exercises/:id", function (b, q, p) { var used = sessions.some(function (s) { return s.exercises.some(function (l) { return l.exerciseId === p[0]; }); }); if (used) err(409, "EXERCISE_IN_USE", "This exercise is used by workout plans or logged workouts. Archive it instead."); exercises = exercises.filter(function (e) { return e.id !== p[0]; }); return null; });
  on("GET", "/admin/lookups/:type", function (b, q, p) { return p[0] === "equipment" ? equipment : muscles; });
  on("POST", "/admin/lookups/:type", function (b, q, p) { var l = lk(b.name); (p[0] === "equipment" ? equipment : muscles).push(l); return l; });
  on("PATCH", "/admin/lookups/:type/:id", function (b, q, p) { var l = lookupById(p[0] === "equipment" ? equipment : muscles, p[1]); Object.assign(l, b); return l; });

  on("GET", "/admin/foods", function (b, q) { return page(exStatus(foods, q).filter(function (f) { return (match(f.name, q.get("q")) || match(f.brand || "", q.get("q"))) && (!q.get("category") || f.category === q.get("category")) && (!q.get("kind") || f.kind === q.get("kind")); }), q); });
  on("POST", "/admin/foods", function (b) { var f = Object.assign({ id: id(), status: "ACTIVE", servingBasis: 100, servingUnit: "GRAM", servingSizes: [], barcode: null, sourceReference: null, createdAt: iso(Date.now()), updatedAt: iso(Date.now()) }, b); f.nutrition = Object.assign(N(0, 0, 0, 0, 0), b.nutrition); foods.push(f); logAudit("FOOD_CREATED", "FOOD", f.id, "Created food " + f.name); return f; });
  on("PATCH", "/admin/foods/:id", function (b, q, p) { var f = lookupById(foods, p[0]); Object.assign(f, b, { updatedAt: iso(Date.now()) }); logAudit("FOOD_UPDATED", "FOOD", f.id, "Updated food " + f.name); return f; });
  on("POST", "/admin/foods/:id/archive", function (b, q, p) { var f = lookupById(foods, p[0]); f.status = "ARCHIVED"; return f; });
  on("POST", "/admin/foods/:id/restore", function (b, q, p) { var f = lookupById(foods, p[0]); f.status = "ACTIVE"; return f; });
  on("DELETE", "/admin/foods/:id", function () { err(409, "FOOD_IN_USE", "This food is used in food logs or meal templates. Archive it instead."); });

  var planSummary = function (p) { var c = Object.assign({}, p); c.activeAssignments = assignments.filter(function (a) { return a.workoutPlanId === p.id && a.status === "ACTIVE"; }).length; return c; };
  on("GET", "/admin/workout-plans", function (b, q) { var st = q.get("status"); return page(plans.filter(function (p) { return (q.get("latestOnly") !== "true" || p.isLatest) && (!st || st === "ALL" || p.status === st) && match(p.name, q.get("q")); }).map(planSummary), q); });
  on("GET", "/admin/workout-plans/:id", function (b, q, p) { return planSummary(lookupById(plans, p[0]) || err(404, "NOT_FOUND", "Workout plan not found")); });
  var buildDays = function (days) { return days.map(function (d, i) { return { id: id(), dayNumber: i + 1, weekday: d.weekday, dayName: d.dayName, exercises: d.exercises.map(function (x, j) { var e = lookupById(exercises, x.exerciseId); return { exerciseId: e.id, exerciseName: e.name, primaryMuscle: e.primaryMuscle && e.primaryMuscle.name, equipment: e.equipment && e.equipment.name, order: j + 1, sets: x.sets, repMin: x.repMin, repMax: x.repMax, restSeconds: x.restSeconds, notes: x.notes || null }; }) }; }); };
  var setPlan = function (p, b) { ["name", "description", "goalType", "experienceLevel", "durationWeeks", "warmUpInstructions"].forEach(function (k) { p[k] = b[k] === undefined ? p[k] : b[k] || null; }); p.days = buildDays(b.days); p.daysPerWeek = p.days.length; p.updatedAt = iso(Date.now()); return p; };
  on("POST", "/admin/workout-plans", function (b) { var p = setPlan({ id: id(), planKey: id(), version: 1, isLatest: true, status: "DRAFT", publishedAt: null, createdAt: iso(Date.now()) }, b); p.versions = [{ id: p.id, version: 1, status: "DRAFT", publishedAt: null }]; plans.unshift(p); logAudit("WORKOUT_PLAN_CREATED", "WORKOUT_PLAN", p.id, "Created plan " + p.name + " (draft v1)"); return planSummary(p); });
  on("PUT", "/admin/workout-plans/:id", function (b, q, p) { var pl = lookupById(plans, p[0]); if (pl.status !== "DRAFT") err(409, "PLAN_NOT_EDITABLE", "Published plans cannot be edited. Create a new version instead."); setPlan(pl, b); return planSummary(pl); });
  var syncVersions = function (key) { var vs = plans.filter(function (x) { return x.planKey === key; }).sort(function (a, b) { return b.version - a.version; }).map(function (x) { return { id: x.id, version: x.version, status: x.status, publishedAt: x.publishedAt }; }); plans.forEach(function (x) { if (x.planKey === key) x.versions = vs; }); };
  on("POST", "/admin/workout-plans/:id/publish", function (b, q, p) { var pl = lookupById(plans, p[0]); plans.forEach(function (x) { if (x.planKey === pl.planKey && x.status === "PUBLISHED") x.status = "ARCHIVED"; }); pl.status = "PUBLISHED"; pl.publishedAt = iso(Date.now()); syncVersions(pl.planKey); logAudit("WORKOUT_PLAN_PUBLISHED", "WORKOUT_PLAN", pl.id, "Published " + pl.name + " v" + pl.version); return planSummary(pl); });
  on("POST", "/admin/workout-plans/:id/revise", function (b, q, p) { var src = lookupById(plans, p[0]); if (plans.some(function (x) { return x.planKey === src.planKey && x.status === "DRAFT"; })) err(409, "DRAFT_EXISTS", "A draft of the next version already exists");
    var max = Math.max.apply(null, plans.filter(function (x) { return x.planKey === src.planKey; }).map(function (x) { return x.version; })); plans.forEach(function (x) { if (x.planKey === src.planKey) x.isLatest = false; });
    var c = JSON.parse(JSON.stringify(src)); c.id = id(); c.version = max + 1; c.status = "DRAFT"; c.publishedAt = null; c.isLatest = true; plans.unshift(c); syncVersions(c.planKey); return planSummary(c); });
  on("POST", "/admin/workout-plans/:id/duplicate", function (b, q, p) { var c = JSON.parse(JSON.stringify(lookupById(plans, p[0]))); c.id = id(); c.planKey = id(); c.version = 1; c.status = "DRAFT"; c.publishedAt = null; c.isLatest = true; c.name = "Copy of " + c.name; c.versions = [{ id: c.id, version: 1, status: "DRAFT", publishedAt: null }]; plans.unshift(c); return planSummary(c); });
  on("POST", "/admin/workout-plans/:id/archive", function (b, q, p) { var pl = lookupById(plans, p[0]); pl.status = "ARCHIVED"; syncVersions(pl.planKey); return planSummary(pl); });
  on("DELETE", "/admin/workout-plans/:id", function (b, q, p) { var pl = lookupById(plans, p[0]); plans = plans.filter(function (x) { return x.id !== p[0]; }); var prev = plans.filter(function (x) { return x.planKey === pl.planKey; }).sort(function (a, c) { return c.version - a.version; })[0]; if (prev) { prev.isLatest = true; syncVersions(pl.planKey); } return null; });
  on("POST", "/admin/assignments", function (b) { var pl = lookupById(plans, b.workoutPlanId), u = lookupById(users, b.userId); assignments.forEach(function (a) { if (a.userId === u.id && a.status === "ACTIVE") { a.status = "CANCELLED"; a.endDate = iso(Date.now()); } });
    var a = { id: id(), userId: u.id, user: { id: u.id, name: u.name, email: u.email }, workoutPlanId: pl.id, planName: pl.name, planVersion: pl.version, latestPublishedVersion: pl.version, startDate: b.startDate + "T00:00:00.000Z", endDate: null, status: "ACTIVE", createdAt: iso(Date.now()) }; assignments.push(a); logAudit("WORKOUT_PLAN_ASSIGNED", "USER", u.id, "Assigned " + pl.name + " v" + pl.version + " to " + u.email); return a; });
  on("POST", "/admin/assignments/:id/end", function (b, q, p) { var a = lookupById(assignments, p[0]); a.status = "CANCELLED"; return a; });
  on("GET", "/admin/meal-templates", function (b, q) { var st = q.get("status"); return page(mealTemplates.filter(function (t) { return !st || st === "ALL" || t.status === st; }), q); });
  on("POST", "/admin/meal-templates", function (b) { var ing = b.ingredients.map(function (i) { var f = lookupById(foods, i.foodId); return { foodId: f.id, name: f.name, brand: f.brand, preparation: f.preparation, quantity: i.quantity, unit: "g", nutrition: scale(f.nutrition, f.servingBasis, i.quantity), foodStatus: f.status }; });
    var t = { id: id(), name: b.name, description: b.description || null, mealType: b.mealType, tags: b.tags || [], ingredients: ing, totalNutrition: sum(ing.map(function (i) { return i.nutrition; })), status: "DRAFT", activeAssignments: 0, createdAt: iso(Date.now()), updatedAt: iso(Date.now()) }; mealTemplates.unshift(t); return t; });
  on("PUT", "/admin/meal-templates/:id", function (b, q, p) { var t = lookupById(mealTemplates, p[0]); var n = routes.filter(function (r) { return r.method === "POST" && r.re.test("/admin/meal-templates"); })[0].fn(b); mealTemplates.shift(); Object.assign(t, n, { id: t.id, status: t.status }); return t; });
  ["publish", "unpublish", "archive", "restore"].forEach(function (a) { on("POST", "/admin/meal-templates/:id/" + a, function (b, q, p) { var t = lookupById(mealTemplates, p[0]); t.status = a === "publish" ? "PUBLISHED" : a === "archive" ? "ARCHIVED" : "DRAFT"; return t; }); });
  on("DELETE", "/admin/meal-templates/:id", function (b, q, p) { mealTemplates = mealTemplates.filter(function (t) { return t.id !== p[0]; }); return null; });
  on("POST", "/admin/meal-assignments", function () { return { ok: true }; });
  on("POST", "/admin/meal-assignments/:id/end", function () { return null; });
  on("GET", "/admin/target-settings", function () { return targetSettings; });
  on("PUT", "/admin/target-settings", function (b) { targetSettings = b; logAudit("TARGET_SETTINGS_UPDATED", "TARGET_SETTINGS", null, "Updated nutrition target defaults"); return targetSettings; });

  function routesGet(path) { return dispatch("GET", path, null, new URLSearchParams()); }
  function dispatch(method, path, body, query) {
    for (var i = 0; i < routes.length; i++) { var r = routes[i]; if (r.method !== method) continue; var m = path.match(r.re); if (m) return r.fn(body || {}, query, m.slice(1)); }
    err(404, "ROUTE_NOT_FOUND", "Not available in the demo: " + method + " " + path);
  }

  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof Request !== "undefined" && input instanceof Request ? input.url : String(input);
    var at = url.indexOf("/api/");
    if (at < 0) return realFetch ? realFetch(input, init) : Promise.reject(new Error("offline"));
    var u = new URL(url.slice(at + 4), "http://demo");
    var method = ((init && init.method) || "GET").toUpperCase();
    var body = init && init.body ? JSON.parse(init.body) : null;
    return new Promise(function (resolve) {
      setTimeout(function () {
        var status = 200, payload;
        try {
          payload = dispatch(method, u.pathname, body, u.searchParams);
          if (payload === null) status = 204;
          else if (method === "POST" && /\/(exercises|foods|workout-plans|meal-templates|measurements|logs|custom-foods|saved-meals|sessions|assignments)$/.test(u.pathname)) status = 201;
        } catch (e) {
          status = e.status || 500;
          payload = e.body || { error: { code: "DEMO_ERROR", message: String(e.message || e) } };
          if (!e.status && window.console) console.error(e);
        }
        resolve(new Response(status === 204 ? null : JSON.stringify(payload), { status: status, headers: { "Content-Type": "application/json" } }));
      }, 120);
    });
  };
})();
