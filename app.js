(function () {
  "use strict";

  function analyze(data) {
    var exById = {};
    (data.exercises || []).forEach(function (e) { exById[e.id] = e; });

    var sets = (data.sets || []).slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });

    var dates = {};
    sets.forEach(function (s) { dates[s.date] = true; });
    var dateList = Object.keys(dates).sort();

    var groupSets = {};
    var byExercise = {};
    sets.forEach(function (s) {
      var ex = exById[s.exerciseId] || { name: s.exerciseId, group: "その他" };
      var g = ex.group || "その他";
      groupSets[g] = (groupSets[g] || 0) + 1;
      if (!byExercise[s.exerciseId]) byExercise[s.exerciseId] = [];
      byExercise[s.exerciseId].push(s);
    });

    var exercises = Object.keys(byExercise).map(function (id) {
      var ex = exById[id] || { name: id, group: "その他", kind: "weight" };
      var ss = byExercise[id];
      var maxWeight = 0;
      ss.forEach(function (s) { if ((s.weight || 0) > maxWeight) maxWeight = s.weight; });
      var lastDate = ss[ss.length - 1].date;
      var lastSets = ss.filter(function (s) { return s.date === lastDate; });
      var best = lastSets[0];
      lastSets.forEach(function (s) {
        var score = (s.weight || 0) * 10000 + (s.reps || 0);
        var bscore = (best.weight || 0) * 10000 + (best.reps || 0);
        if (score > bscore) best = s;
      });
      return {
        id: id, name: ex.name, group: ex.group || "その他", kind: ex.kind || "weight",
        totalSets: ss.length, days: Object.keys(ss.reduce(function (m, s) { m[s.date] = 1; return m; }, {})).length,
        maxWeight: maxWeight, lastDate: lastDate, lastSets: lastSets, best: best
      };
    }).sort(function (a, b) { return b.totalSets - a.totalSets; });

    var untrained = (data.exercises || []).filter(function (e) { return !byExercise[e.id]; });

    var byDate = {};
    sets.forEach(function (s) {
      if (!byDate[s.date]) byDate[s.date] = [];
      byDate[s.date].push(s);
    });

    return {
      exById: exById, totalSets: sets.length, dateList: dateList,
      groupSets: groupSets, exercises: exercises, untrained: untrained, byDate: byDate
    };
  }

  function nextSuggestion(ex) {
    if (ex.kind === "time") return "前回の時間を目安に、少しだけ長く";
    if (ex.kind === "bodyweight") {
      var br = ex.best.reps || 0;
      return br >= 20 ? "回数を増やすか、ゆっくり動作で" : "前回より+1〜2回を目標に";
    }
    var w = ex.best.weight || 0;
    var r = ex.best.reps || 0;
    if (w === 0) return "前回の回数+1を目標に";
    if (r >= 10) {
      var up = 2.5;
      return (Math.round((w + up) * 100) / 100) + "kgに挑戦（無理なら" + w + "kg）";
    }
    if (r >= 6) return w + "kgのまま、+1回を目標に";
    return w + "kgでフォーム優先、回数を戻す";
  }

  function fmtSet(s, kind) {
    if (kind === "time") return (s.seconds || 0) + "秒";
    if (kind === "bodyweight") return (s.reps || 0) + "回";
    return (s.weight || 0) + "kg × " + (s.reps || 0) + "回";
  }

  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function render(data, label) {
    var a = analyze(data);
    document.getElementById("dataInfo").textContent = label;

    var first = a.dateList[0] || "-";
    var last = a.dateList[a.dateList.length - 1] || "-";
    var trainedGroups = Object.keys(a.groupSets).length;
    var cards = [
      { num: a.totalSets + " セット", label: "記録された総セット数" },
      { num: a.dateList.length + " 日", label: first + " 〜 " + last },
      { num: a.exercises.length + " 種目", label: "実施した種目" },
      { num: trainedGroups + " 部位", label: "鍛えた部位の数" }
    ];
    document.getElementById("summaryCards").innerHTML = cards.map(function (c) {
      return '<div class="card"><div class="num">' + esc(c.num) + '</div><div class="label">' + esc(c.label) + "</div></div>";
    }).join("");

    var groups = Object.keys(a.groupSets).map(function (g) { return { name: g, count: a.groupSets[g] }; })
      .sort(function (x, y) { return y.count - x.count; });
    var max = groups.length ? groups[0].count : 0;
    var min = groups.length ? groups[groups.length - 1].count : 0;
    document.getElementById("balanceChart").innerHTML = groups.map(function (g) {
      var pct = max ? Math.round((g.count / max) * 100) : 0;
      var cls = g.count === min && groups.length > 1 ? "bar-row least" : "bar-row";
      return '<div class="' + cls + '"><div class="bar-name">' + esc(g.name) + '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="bar-val">' + g.count + " セット</div></div>";
    }).join("");

    if (groups.length > 1) {
      var top = groups[0], least = groups[groups.length - 1];
      document.getElementById("balanceInsight").textContent =
        "一番多いのは「" + top.name + "」で" + top.count + "セット、一番少ないのは「" + least.name + "」で" + least.count +
        "セットです。見た目を大きくしたいなら、少ない部位に少しずつセットを足すのが近道です。";
    } else {
      document.getElementById("balanceInsight").textContent = "部位がまだ1つだけ記録されています。";
    }

    document.getElementById("exerciseRows").innerHTML = a.exercises.map(function (ex) {
      var lastText = ex.lastSets.map(function (s) { return fmtSet(s, ex.kind); }).join(" / ");
      var maxText = ex.kind === "weight" ? ex.maxWeight + "kg" : "-";
      return "<tr><td><strong>" + esc(ex.name) + "</strong><br><small>" + ex.totalSets + "セット・" + ex.days + "日</small></td>" +
        "<td>" + esc(ex.group) + "</td>" +
        "<td>" + esc(ex.lastDate) + "<br>" + esc(lastText) + "</td>" +
        "<td>" + esc(maxText) + "</td>" +
        '<td class="next">' + esc(nextSuggestion(ex)) + "</td></tr>";
    }).join("");

    var up = document.getElementById("untrainedPanel");
    if (a.untrained.length) {
      up.style.display = "";
      document.getElementById("untrainedChips").innerHTML = a.untrained.map(function (e) {
        return '<span class="chip">' + esc(e.name) + "（" + esc(e.group || "") + "）</span>";
      }).join("");
    } else {
      up.style.display = "none";
    }

    var recent = a.dateList.slice(-5).reverse();
    document.getElementById("recentDays").innerHTML = recent.map(function (d) {
      var ss = a.byDate[d];
      var names = {};
      ss.forEach(function (s) {
        var ex = a.exById[s.exerciseId];
        names[ex ? ex.name : s.exerciseId] = true;
      });
      return '<div class="day"><div class="day-head">' + esc(d) + " ・ " + ss.length + 'セット</div>' +
        '<div class="day-body">' + esc(Object.keys(names).join("、")) + "</div></div>";
    }).join("");
  }

  document.getElementById("sampleBtn").addEventListener("click", function () {
    render(window.SAMPLE_DATA, "サンプル記録を表示中");
  });

  document.getElementById("fileInput").addEventListener("change", function (ev) {
    var file = ev.target.files && ev.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data.exercises || !data.sets) throw new Error("format");
        render(data, "読み込んだ記録: " + file.name);
      } catch (e) {
        document.getElementById("dataInfo").textContent = "読み込めませんでした。記録アプリのバックアップJSONを選んでください。";
      }
    };
    reader.readAsText(file);
  });

  render(window.SAMPLE_DATA, "サンプル記録を表示中");
})();
