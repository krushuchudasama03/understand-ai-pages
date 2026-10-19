/*
 * UnderstandAI — browser engine
 * ---------------------------------------------------------------
 * A static port of the original R engine:
 *   • TF-IDF term vectors over the concept corpus
 *   • spherical k-means (k = 3) for unsupervised cluster labels
 *   • cosine matching from a student question to concept centroids
 *   • rule-based reasoning diagnostics
 *   • Wikipedia research when no concept is close enough
 *
 * No backend, API key, or build step is required.
 */
(function (root) {
  "use strict";

  var CORPUS = root.UAI_CORPUS || { concepts: [] };
  var CONCEPTS = CORPUS.concepts || [];

  var STOPWORDS = new Set(
    ("a an the is are was were be been being am of to in on at by for with from and or but if then than that this these those " +
      "it its as i me my mine we our ours you your yours he him his she her hers they them their theirs " +
      "do does did done doing how what why when where who whom which whose can could should would will shall may might must " +
      "not no nor so very just also about into over under again more most some any all each both few many much " +
      "there here such own same too only own up down out off once please explain tell show give").split(/\s+/)
  );

  // ---------------------------------------------------------------------------
  // Text processing
  // ---------------------------------------------------------------------------
  function normalize(text) {
    return String(text == null ? "" : text)
      .replace(/[\u2018\u2019\u02bc]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/\u00b2|\^2/g, " squared ")
      .replace(/[\u00d7\u2715]/g, " times ")
      .replace(/\u00f7/g, " divided by ")
      .replace(/%/g, " percent ")
      .toLowerCase()
      .replace(/[^a-z0-9']+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stem(word) {
    if (word.length <= 3) return word;
    if (/[^aeiou]ies$/.test(word)) return word.slice(0, -3) + "y";
    if (/(ches|shes|xes|zes|sses)$/.test(word)) return word.slice(0, -2);
    if (word.endsWith("ing") && word.length > 5) word = word.slice(0, -3);
    else if (word.endsWith("ed") && word.length > 4) word = word.slice(0, -2);
    else if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) word = word.slice(0, -1);
    if (word.endsWith("e") && word.length > 4) word = word.slice(0, -1);
    return word;
  }

  function tokenize(text) {
    var words = normalize(text).split(" ");
    var out = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i].replace(/^'+|'+$/g, "");
      if (!w || STOPWORDS.has(w)) continue;
      if (/^[0-9]+$/.test(w)) continue;
      if (w.indexOf("'") !== -1) w = w.split("'")[0];
      if (!w || w.length < 2) continue;
      out.push(stem(w));
    }
    return out;
  }

  function termCounts(tokens) {
    var counts = new Map();
    for (var i = 0; i < tokens.length; i++) {
      counts.set(tokens[i], (counts.get(tokens[i]) || 0) + 1);
    }
    return counts;
  }

  function docText(concept) {
    var parts = [
      concept.name,
      concept.name,
      concept.domain,
      concept.summary,
      concept.intuition,
      (concept.keywords || []).join(" "),
      (concept.keywords || []).join(" ")
    ];
    if (concept.worked_example) {
      parts.push(concept.worked_example.problem || "");
      (concept.worked_example.step_by_step || []).forEach(function (step) {
        parts.push(step.step + " " + step.reasoning + " " + (step.value || ""));
      });
      parts.push(concept.worked_example.key_takeaway || "");
    }
    (concept.practice_challenges || []).forEach(function (ch) {
      parts.push(ch.question + " " + (ch.reasoning_checklist || []).join(" "));
    });
    (concept.misconceptions || []).forEach(function (m) {
      parts.push(m.name + " " + m.diagnosis + " " + (m.trigger_patterns || []).join(" "));
    });
    return parts.join(" ");
  }

  function normalizeVector(vec) {
    var sum = 0;
    vec.forEach(function (v) {
      sum += v * v;
    });
    var mag = Math.sqrt(sum) || 1;
    var out = new Map();
    vec.forEach(function (v, k) {
      out.set(k, v / mag);
    });
    return out;
  }

  function cosine(a, b) {
    var small = a.size < b.size ? a : b;
    var large = small === a ? b : a;
    var dot = 0;
    small.forEach(function (v, k) {
      if (large.has(k)) dot += v * large.get(k);
    });
    return dot;
  }

  // ---------------------------------------------------------------------------
  // TF-IDF model
  // ---------------------------------------------------------------------------
  var model = null;

  function buildModel() {
    var docs = CONCEPTS.map(function (c) {
      return { concept: c, tokens: tokenize(docText(c)) };
    });

    var df = new Map();
    docs.forEach(function (doc) {
      var seen = new Set(doc.tokens);
      seen.forEach(function (t) {
        df.set(t, (df.get(t) || 0) + 1);
      });
    });

    var N = docs.length || 1;
    docs.forEach(function (doc) {
      var counts = termCounts(doc.tokens);
      var vec = new Map();
      counts.forEach(function (tf, term) {
        var idf = Math.log((N + 1) / ((df.get(term) || 0) + 1)) + 1;
        vec.set(term, (1 + Math.log(tf)) * idf);
      });
      doc.vector = normalizeVector(vec);
    });

    var clusters = sphericalKMeans(docs.map(function (d) { return d.vector; }), Math.min(3, docs.length));
    docs.forEach(function (doc, i) {
      doc.cluster = clusters[i] + 1;
    });

    model = { docs: docs, df: df, N: N };
    return model;
  }

  function queryVector(question) {
    var counts = termCounts(tokenize(question));
    var vec = new Map();
    counts.forEach(function (tf, term) {
      var idf = Math.log((model.N + 1) / ((model.df.get(term) || 0) + 1)) + 1;
      vec.set(term, (1 + Math.log(tf)) * idf);
    });
    return normalizeVector(vec);
  }

  function sphericalKMeans(vectors, k) {
    if (!vectors.length) return [];
    if (k <= 1) return vectors.map(function () { return 0; });

    // Deterministic farthest-first initialisation.
    var centroids = [new Map(vectors[0])];
    while (centroids.length < k) {
      var bestIndex = 0;
      var bestDistance = -1;
      for (var i = 0; i < vectors.length; i++) {
        var maxSim = -1;
        for (var c = 0; c < centroids.length; c++) {
          maxSim = Math.max(maxSim, cosine(vectors[i], centroids[c]));
        }
        if (1 - maxSim > bestDistance) {
          bestDistance = 1 - maxSim;
          bestIndex = i;
        }
      }
      centroids.push(new Map(vectors[bestIndex]));
    }

    var assignments = new Array(vectors.length).fill(0);
    for (var iter = 0; iter < 40; iter++) {
      var changed = false;
      for (var v = 0; v < vectors.length; v++) {
        var best = 0;
        var bestSim = -Infinity;
        for (var c2 = 0; c2 < centroids.length; c2++) {
          var sim = cosine(vectors[v], centroids[c2]);
          if (sim > bestSim) {
            bestSim = sim;
            best = c2;
          }
        }
        if (assignments[v] !== best) {
          assignments[v] = best;
          changed = true;
        }
      }
      if (!changed && iter > 0) break;

      var sums = centroids.map(function () { return new Map(); });
      for (var vi = 0; vi < vectors.length; vi++) {
        var target = sums[assignments[vi]];
        vectors[vi].forEach(function (value, term) {
          target.set(term, (target.get(term) || 0) + value);
        });
      }
      centroids = sums.map(function (sum) {
        if (sum.size === 0) return new Map();
        return normalizeVector(sum);
      });
    }
    return assignments;
  }

  function keywordPresent(q, keyword) {
    if (keyword.indexOf(" ") !== -1) return q.indexOf(keyword) !== -1;
    var start = 0;
    while (start < q.length) {
      var idx = q.indexOf(keyword, start);
      if (idx === -1) return false;
      var beforeOk = idx === 0 || q.charAt(idx - 1) === " ";
      var rest = q.slice(idx + keyword.length);
      var afterOk = rest === "" || /^(s|es|d|ed)?(\s|$)/.test(rest);
      if (beforeOk && afterOk) return true;
      start = idx + 1;
    }
    return false;
  }

  function keywordHits(question, concept) {
    var q = normalize(question);
    var hits = 0;
    (concept.keywords || []).forEach(function (kw) {
      var k = normalize(kw);
      if (!k) return;
      if (keywordPresent(q, k)) hits += k.indexOf(" ") !== -1 ? 2 : 1;
    });
    return hits;
  }

  /**
   * Map a free-text question onto the concept space.
   * Returns a decision that the UI can explain honestly.
   */
  function mapQuestion(question) {
    if (!model) buildModel();
    var trimmed = String(question || "").trim();
    if (!trimmed) {
      return { known: false, reason: "empty", scores: [] };
    }

    // Light query expansion for notation the corpus words cannot see:
    // "3/4 + 1/6" reads as fraction arithmetic; "2x + 3 = 11" reads as
    // a linear equation. These are cue terms, not supervised labels.
    var expanded = trimmed;
    var lower = trimmed.toLowerCase();
    if (/\d+\s*\/\s*\d+/.test(trimmed)) {
      expanded += " fraction numerator denominator";
    }
    if (!/(\^2|\u00b2|squared)/.test(lower) && (/\d+\s*x\b/.test(lower) || (/\bx\b/.test(lower) && /=/.test(lower)))) {
      expanded += " equation solve for x linear variable coefficient isolate both sides";
    }
    if (/(speed|velocity|acceleration|free fall|dropped|thrown|projectile|motion)/.test(lower) &&
        /(ball|car|train|height|meter|second|distance|ground)/.test(lower)) {
      expanded += " kinematics motion";
    }

    var qVec = queryVector(expanded);
    var scored = model.docs.map(function (doc) {
      var sim = cosine(qVec, doc.vector);
      var hits = keywordHits(trimmed, doc.concept);
      return {
        concept: doc.concept,
        cluster: doc.cluster,
        similarity: sim,
        hits: hits,
        score: sim + Math.min(0.18, hits * 0.035)
      };
    }).sort(function (a, b) { return b.score - a.score; });

    var best = scored[0];
    var second = scored[1] || { score: 0 };
    var known =
      best.similarity >= 0.13 ||
      (best.hits >= 1 && best.similarity >= 0.09);

    if (!known) {
      return {
        known: false,
        reason: "no-close-concept",
        scores: scored.map(function (s) {
          return { conceptId: s.concept.id, similarity: round(s.similarity, 3), hits: s.hits };
        })
      };
    }

    var fit = best.score + second.score > 0 ? best.score / (best.score + second.score) : 0.5;
    var confidence = Math.max(0.55, Math.min(0.97, 0.5 + fit * 0.47));

    return {
      known: true,
      conceptId: best.concept.id,
      name: best.concept.name,
      domain: best.concept.domain,
      clusterId: best.cluster,
      confidence: Math.round(confidence * 100) / 100,
      similarity: round(best.similarity, 3),
      keywordHits: best.hits,
      scores: scored.map(function (s) {
        return { conceptId: s.concept.id, similarity: round(s.similarity, 3), hits: s.hits };
      })
    };
  }

  function getConcept(id) {
    return CONCEPTS.find(function (c) { return c.id === id; }) || null;
  }

  function getChallenge(conceptId, index) {
    var c = getConcept(conceptId);
    if (!c) return null;
    var list = c.practice_challenges || [];
    if (!list.length) return null;
    var i = Math.max(0, Math.min(list.length - 1, index || 0));
    return { challenge: list[i], index: i, total: list.length };
  }

  // ---------------------------------------------------------------------------
  // Reasoning evaluation
  // ---------------------------------------------------------------------------
  function round(n, digits) {
    var p = Math.pow(10, digits || 0);
    return Math.round(n * p) / p;
  }

  function cleanAnswer(raw) {
    return String(raw == null ? "" : raw)
      .toLowerCase()
      .replace(/[\u2212\u2013\u2014]/g, "-")
      .replace(/[$,]/g, "")
      .replace(/%/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseValue(raw) {
    var s = cleanAnswer(raw)
      .replace(/^x\s*=\s*/, "")
      .replace(/[^0-9./-]/g, " ")
      .trim();
    var fraction = s.match(/(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    if (fraction) {
      var den = parseFloat(fraction[2]);
      if (den !== 0) return parseFloat(fraction[1]) / den;
    }
    var number = s.match(/-?\d+(?:\.\d+)?/);
    return number ? parseFloat(number[0]) : null;
  }

  function fractionText(raw) {
    var m = cleanAnswer(raw).match(/(-?\d+)\s*\/\s*(\d+)/);
    return m ? m[1] + "/" + m[2] : null;
  }

  function evaluateChallenge(conceptId, challengeIndex, studentAnswer, studentReasoning, alreadySolved) {
    var found = getChallenge(conceptId, challengeIndex);
    if (!found) return { correct: false, error: "Unknown challenge." };
    var challenge = found.challenge;
    var concept = getConcept(conceptId);

    var answer = String(studentAnswer || "").trim();
    var reasoning = String(studentReasoning || "").trim();
    var parsed = parseValue(answer);
    var expectedValues = (challenge.acceptable_numeric || [challenge.expected_answer]).map(function (v) {
      return typeof v === "number" ? v : parseValue(v);
    }).filter(function (v) { return v !== null; });

    var correct = false;
    var answerFraction = fractionText(answer);
    var expectedFraction = fractionText(challenge.expected_answer);
    if (answerFraction && expectedFraction && answerFraction === expectedFraction) {
      correct = true;
    }
    if (!correct && parsed !== null) {
      correct = expectedValues.some(function (v) {
        return Math.abs(parsed - v) <= Math.max(0.05, Math.abs(v) * 0.004);
      });
    }

    var misconception = null;
    var note = null;

    if (!correct) {
      var errors = challenge.common_errors || {};
      var errorKeys = Object.keys(errors);
      for (var i = 0; i < errorKeys.length; i++) {
        var errKey = errorKeys[i];
        var errParsed = parseValue(errKey);
        var matchesNumber = parsed !== null && errParsed !== null && Math.abs(parsed - errParsed) < 0.001;
        var matchesText = cleanAnswer(answer) === cleanAnswer(errKey);
        if (matchesNumber || matchesText) {
          var diagnosis = errors[errKey];
          var knownMis = (concept.misconceptions || []).find(function (m) { return m.id === diagnosis; });
          if (knownMis) {
            misconception = knownMis;
          } else {
            note = String(diagnosis).charAt(0).toUpperCase() + String(diagnosis).slice(1) + ".";
          }
          break;
        }
      }
    }

    if (!misconception) {
      var text = normalize(answer + " " + reasoning);
      (concept.misconceptions || []).some(function (m) {
        var hit = (m.trigger_patterns || []).some(function (pattern) {
          return pattern && text.indexOf(normalize(pattern)) !== -1;
        });
        if (hit) {
          misconception = m;
          return true;
        }
        return false;
      });
    }

    var hasNext = found.index + 1 < found.total;

    return {
      correct: correct,
      alreadySolved: Boolean(alreadySolved),
      points: correct ? (alreadySolved ? 0 : 25) : 0,
      studentAnswer: answer,
      studentReasoning: reasoning,
      expectedAnswer: challenge.expected_answer_display || String(challenge.expected_answer),
      expectedValue: challenge.expected_answer,
      status: correct
        ? (alreadySolved ? "Already credited" : "Independent solve")
        : "Not there yet",
      misconception: misconception
        ? {
            id: misconception.id,
            name: misconception.name,
            diagnosis: misconception.diagnosis,
            hint: misconception.remediation_hint
          }
        : null,
      note: note,
      checklist: challenge.reasoning_checklist || [],
      nextChallenge: hasNext ? { index: found.index + 1, level: (concept.practice_challenges[found.index + 1].level || "practice") } : null,
      totalChallenges: found.total,
      challengeIndex: found.index
    };
  }

  // ---------------------------------------------------------------------------
  // Wikipedia research fallback
  // ---------------------------------------------------------------------------
  function researchQuery(question) {
    var original = String(question || "").replace(/\s+/g, " ").trim();
    var q = original.replace(/[?!.]+$/g, "");

    // Keep the first question. "Who was Ada Lovelace and why..." should
    // search for "Ada Lovelace", not the whole paragraph.
    q = q.replace(/[,;]?\s+(and|but)\s+(why|how|what|who|where|when|which)\b[\s\S]*$/i, "");
    q = q.replace(/[,;]?\s+(and|but)\s+(is|are|was|were|does|do|did|can|could|would|will)\b[\s\S]*$/i, "");

    // Causal questions search better as full questions ("Why is the sky
    // blue?" → Diffuse sky radiation). Entity questions search better with
    // the question words removed ("Who was Ada Lovelace" → Ada Lovelace).
    if (/^(why|how)\b/i.test(q) && q.split(/\s+/).length > 2) {
      return q.trim() || original;
    }

    q = q.replace(/^(please\s+)?(can|could|would|will)\s+you\s+/i, "");
    q = q.replace(/^(explain|describe|define|summari[sz]e|tell me about|tell me)\s+/i, "");
    q = q.replace(/^(who|what|where|when|why|how|which)\s+(was|is|are|were|do|does|did|can|could|would|will|has|have|had)\s+/i, "");
    q = q.replace(/^(who|what|where|when|why|how|which)\s+/i, "");
    q = q.replace(/^(the|a|an)\s+/i, "");
    q = q.replace(/\s+/g, " ").trim();

    return q || original;
  }

  function wikipediaUrl(term) {
    return "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*" +
      "&generator=search&gsrsearch=" + encodeURIComponent(term) +
      "&gsrlimit=4&prop=extracts|pageimages|info&inprop=url" +
      "&exintro=1&explaintext=1&exlimit=4&piprop=thumbnail&pithumbsize=480";
  }

  function googleUrl(query) {
    return "https://www.google.com/search?q=" + encodeURIComponent(query);
  }

  function shortenExtract(extract) {
    var text = String(extract || "").replace(/\s+/g, " ").trim();
    if (text.length <= 1400) return text;
    var cut = text.slice(0, 1400);
    var lastStop = cut.lastIndexOf(". ");
    if (lastStop > 700) cut = cut.slice(0, lastStop + 1);
    return cut + " …";
  }

  /**
   * Look the question up on Wikipedia. Returns a sourced briefing,
   * or a graceful not-found result. Never invents content.
   */
  async function research(question, options) {
    options = options || {};
    var term = researchQuery(question);
    var url = wikipediaUrl(term);
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, options.timeout || 10000) : null;

    try {
      var response = await (options.fetch || fetch)(url, controller ? { signal: controller.signal } : {});
      if (!response.ok) throw new Error("Wikipedia responded " + response.status);
      var data = await response.json();
      if (timer) clearTimeout(timer);

      var pages = data && data.query && data.query.pages ? Object.keys(data.query.pages).map(function (key) {
        return data.query.pages[key];
      }) : [];
      pages.sort(function (a, b) { return (a.index || 99) - (b.index || 99); });

      var usable = pages.filter(function (p) {
        return p.extract && p.extract.trim().length > 60 && !/\(disambiguation\)$/i.test(p.title || "");
      });

      if (!usable.length) {
        return {
          found: false,
          query: term,
          source: "Wikipedia",
          googleUrl: googleUrl(term),
          wikiSearchUrl: "https://en.wikipedia.org/w/index.php?search=" + encodeURIComponent(term),
          message: "No article in the English Wikipedia index was close enough to summarize."
        };
      }

      var page = usable[0];
      return {
        found: true,
        query: term,
        title: page.title,
        extract: shortenExtract(page.extract),
        url: page.fullurl || ("https://en.wikipedia.org/wiki/" + encodeURIComponent(page.title.replace(/ /g, "_"))),
        thumbnail: page.thumbnail && page.thumbnail.source ? page.thumbnail.source : null,
        source: "Wikipedia",
        license: "Wikipedia text, CC BY-SA 4.0",
        googleUrl: googleUrl(term),
        wikiSearchUrl: "https://en.wikipedia.org/w/index.php?search=" + encodeURIComponent(term),
        related: usable.slice(1, 3).map(function (p) {
          return { title: p.title, url: p.fullurl || ("https://en.wikipedia.org/wiki/" + encodeURIComponent(p.title.replace(/ /g, "_"))) };
        }),
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      if (timer) clearTimeout(timer);
      return {
        found: false,
        error: true,
        query: term,
        source: "Wikipedia",
        googleUrl: googleUrl(term),
        wikiSearchUrl: "https://en.wikipedia.org/w/index.php?search=" + encodeURIComponent(term),
        message: "The Wikipedia lookup could not complete. Check your connection and try again."
      };
    }
  }

  // Build eagerly so the first question feels instant.
  buildModel();

  root.UAIEngine = {
    concepts: CONCEPTS,
    mapQuestion: mapQuestion,
    getConcept: getConcept,
    getChallenge: getChallenge,
    evaluateChallenge: evaluateChallenge,
    research: research,
    researchQuery: researchQuery,
    googleUrl: googleUrl,
    tokenize: tokenize,
    clusterCount: Math.min(3, CONCEPTS.length)
  };
})(typeof window !== "undefined" ? window : globalThis);
