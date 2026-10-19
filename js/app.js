/*
 * UnderstandAI — application shell
 * Accounts, sessions, mastery, lesson cards, and the research fallback all
 * live in localStorage. There is no server and no network call except the
 * public Wikipedia API used by the researcher.
 */
(function () {
  "use strict";

  var STORE = {
    users: "uai.v1.users",
    current: "uai.v1.current",
    sessions: "uai.v1.sessions",
    research: "uai.v1.research"
  };
  var DEMO_ID = "user_demo_001";
  var DEMO_SALT = "uai-demo-salt";
  // SHA-256 of "uai-demo-salt:student123"
  var DEMO_HASH = "89252fda5ad4fe393709fadb55bfc98f869385f69fa0d0b233bdbb92a074234c";
  var RESEARCH_TTL = 30 * 24 * 60 * 60 * 1000;

  var memoryStore = {};

  var STATE = {
    user: null,
    sessionId: null,
    busy: false
  };

  var DOM = {};

  // ---------------------------------------------------------------------------
  // Small utilities
  // ---------------------------------------------------------------------------
  function readJSON(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      memoryStore[key] = value;
    }
  }

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char];
    });
  }

  function icon(name, className) {
    return '<svg class="icon ' + (className || "") + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function initial(name) {
    return String(name || "?").trim().charAt(0).toUpperCase() || "?";
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function plural(count, word) {
    return count + " " + word + (count === 1 ? "" : "s");
  }

  function relativeTime(iso) {
    var time = new Date(iso).getTime();
    if (isNaN(time)) return "";
    var diff = Date.now() - time;
    if (diff < 45000) return "just now";
    if (diff < 3600000) return Math.max(1, Math.round(diff / 60000)) + "m ago";
    if (diff < 86400000) return Math.max(1, Math.round(diff / 3600000)) + "h ago";
    if (diff < 7 * 86400000) return Math.max(1, Math.round(diff / 86400000)) + "d ago";
    return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function dateLabel(iso) {
    var time = new Date(iso).getTime();
    if (isNaN(time)) return "";
    return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function autoGrow() {
    DOM.askInput.style.height = "auto";
    DOM.askInput.style.height = Math.min(DOM.askInput.scrollHeight, 170) + "px";
  }

  // ---------------------------------------------------------------------------
  // Local accounts
  // ---------------------------------------------------------------------------
  function demoUser() {
    var now = new Date().toISOString();
    return {
      id: DEMO_ID,
      username: "alex_learner",
      email: "alex@understand.ai",
      salt: DEMO_SALT,
      hash: DEMO_HASH,
      createdAt: now,
      stats: { xp: 120, attempted: 4, solves: 3, streak: 3 },
      mastery: {
        percentages_proportions: { score: 75, attempts: 3, solves: 2, misses: 1, last: now },
        linear_equations: { score: 45, attempts: 1, solves: 1, misses: 0, last: now }
      }
    };
  }

  function loadUsers() {
    var users = readJSON(STORE.users, null);
    if (!Array.isArray(users) || users.length === 0) {
      users = [demoUser()];
      writeJSON(STORE.users, users);
    }
    if (!users.some(function (u) { return u.id === DEMO_ID; })) {
      users.unshift(demoUser());
      writeJSON(STORE.users, users);
    }
    return users;
  }

  function saveUsers(users) {
    writeJSON(STORE.users, users);
  }

  function saveCurrentUser() {
    var users = loadUsers();
    var index = users.findIndex(function (u) { return u.id === STATE.user.id; });
    if (index >= 0) {
      users[index] = STATE.user;
      saveUsers(users);
    }
  }

  function setCurrentUser(user) {
    STATE.user = user;
    writeJSON(STORE.current, user.id);
  }

  function hashPassword(password, salt) {
    var text = salt + ":" + password;
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buffer) {
        return Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
          return byte.toString(16).padStart(2, "0");
        }).join("");
      });
    }
    // Last-resort fallback for very old insecure contexts.
    var h1 = 0x811c9dc5;
    var h2 = 0x1000193;
    for (var i = 0; i < text.length; i++) {
      h1 ^= text.charCodeAt(i);
      h1 = Math.imul(h1, 16777619);
      h2 ^= text.charCodeAt(i) + i;
      h2 = Math.imul(h2, 2246822519);
    }
    return Promise.resolve(
      ("00000000" + (h1 >>> 0).toString(16)).slice(-8) +
      ("00000000" + (h2 >>> 0).toString(16)).slice(-8)
    );
  }

  function randomSalt() {
    if (window.crypto && window.crypto.getRandomValues) {
      var values = new Uint32Array(2);
      window.crypto.getRandomValues(values);
      return values[0].toString(16) + values[1].toString(16);
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // ---------------------------------------------------------------------------
  // Sessions and research cache
  // ---------------------------------------------------------------------------
  function readSessions() {
    var sessions = readJSON(STORE.sessions, []);
    return Array.isArray(sessions) ? sessions : [];
  }

  function userSessions() {
    return readSessions()
      .filter(function (session) { return session.userId === STATE.user.id; })
      .sort(function (a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); });
  }

  function getSessionById(sessionId) {
    if (!sessionId) return null;
    return readSessions().find(function (session) {
      return session.id === sessionId && session.userId === STATE.user.id;
    }) || null;
  }

  function getSession() {
    return getSessionById(STATE.sessionId);
  }

  function saveSession(session) {
    var sessions = readSessions();
    var index = sessions.findIndex(function (item) { return item.id === session.id; });
    if (index >= 0) sessions[index] = session;
    else sessions.push(session);
    writeJSON(STORE.sessions, sessions);
  }

  function createSession(title) {
    var now = new Date().toISOString();
    var session = {
      id: uid("s_"),
      userId: STATE.user.id,
      title: title.length > 68 ? title.slice(0, 68).replace(/\s+\S*$/, "") + "…" : title,
      conceptId: null,
      createdAt: now,
      updatedAt: now,
      messages: []
    };
    saveSession(session);
    STATE.sessionId = session.id;
    return session;
  }

  function findSessionAndMessage(messageId) {
    var session = getSession();
    if (!session) return { session: null, message: null };
    var message = session.messages.find(function (item) { return item.id === messageId; }) || null;
    return { session: session, message: message };
  }

  function cacheKey(question) {
    return String(question || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function getCache() {
    var cache = readJSON(STORE.research, {});
    return cache && typeof cache === "object" && !Array.isArray(cache) ? cache : {};
  }

  function getCachedResearch(question) {
    var item = getCache()[cacheKey(question)];
    if (!item || !item.found) return null;
    if (Date.now() - new Date(item.fetchedAt).getTime() > RESEARCH_TTL) return null;
    return item;
  }

  function cacheResearch(question, result) {
    var cache = getCache();
    cache[cacheKey(question)] = result;
    var keys = Object.keys(cache).sort(function (a, b) {
      return new Date(cache[b].fetchedAt || 0) - new Date(cache[a].fetchedAt || 0);
    });
    while (keys.length > 30) delete cache[keys.pop()];
    writeJSON(STORE.research, cache);
  }

  // ---------------------------------------------------------------------------
  // Chrome and navigation
  // ---------------------------------------------------------------------------
  function updateChrome() {
    var user = STATE.user;
    if (!user) return;
    var stats = user.stats || { xp: 0, solves: 0 };
    DOM.userDisplayName.textContent = user.username;
    DOM.userMeta.textContent = stats.xp + " XP · " + stats.solves + " solves";
    DOM.userAvatar.textContent = initial(user.username);
    DOM.xpBadge.textContent = stats.xp + " XP";
    DOM.engineCount.textContent = UAIEngine.concepts.length + " concepts · " + UAIEngine.clusterCount + " clusters";
  }

  function setTopic(title) {
    DOM.activeTopic.textContent = title || "New lesson";
    DOM.activeTopic.title = title || "";
  }

  function setConceptChip(label) {
    if (label) {
      DOM.conceptChip.hidden = false;
      DOM.conceptChipText.textContent = label;
    } else {
      DOM.conceptChip.hidden = true;
      DOM.conceptChipText.textContent = "";
    }
  }

  function resetLesson() {
    STATE.sessionId = null;
    DOM.messages.innerHTML = "";
    DOM.welcome.hidden = false;
    setTopic("New lesson");
    setConceptChip(null);
    DOM.askInput.value = "";
    autoGrow();
    DOM.scrollArea.scrollTo({ top: 0, behavior: "auto" });
    renderSessions();
    closeSidebar();
    setTimeout(function () { DOM.askInput.focus(); }, 40);
  }

  function openSession(sessionId) {
    var session = readSessions().find(function (item) {
      return item.id === sessionId && item.userId === STATE.user.id;
    });
    if (!session) return;

    STATE.sessionId = session.id;
    DOM.welcome.hidden = true;
    DOM.messages.innerHTML = "";
    setTopic(session.title);

    var lastCard = null;
    session.messages.forEach(function (message) {
      appendMessage(message, false);
      if (message.type === "lesson" || message.type === "briefing") lastCard = message;
    });

    if (lastCard && lastCard.type === "lesson") setConceptChip(lastCard.data.name);
    else if (lastCard && lastCard.type === "briefing") setConceptChip("Web research");
    else setConceptChip(null);

    renderSessions();
    closeSidebar();
    scrollToBottom(false);
  }

  function renderSessions() {
    var sessions = userSessions();
    if (!sessions.length) {
      DOM.sessionList.innerHTML = '<p class="session-empty">Your questions will collect here.</p>';
      return;
    }
    DOM.sessionList.innerHTML = sessions.map(function (session) {
      var questions = session.messages.filter(function (message) { return message.role === "user"; }).length;
      return (
        '<div class="session' + (session.id === STATE.sessionId ? " is-active" : "") + '">' +
          '<button class="session-open" type="button" data-session-id="' + escapeHtml(session.id) + '" aria-label="Open ' + escapeHtml(session.title) + '">' +
            '<span class="session-copy">' +
              '<span class="session-title">' + escapeHtml(session.title) + '</span>' +
              '<span class="session-meta">' + plural(questions, "question") + " · " + relativeTime(session.updatedAt) + '</span>' +
            '</span>' +
          '</button>' +
          '<button class="session-delete" type="button" data-delete-session="' + escapeHtml(session.id) + '" aria-label="Delete session">' + icon("close") + '</button>' +
        '</div>'
      );
    }).join("");
  }

  function deleteSession(sessionId) {
    var sessions = readSessions();
    var index = sessions.findIndex(function (item) {
      return item.id === sessionId && item.userId === STATE.user.id;
    });
    if (index < 0) return;
    var removed = sessions[index];
    sessions.splice(index, 1);
    writeJSON(STORE.sessions, sessions);
    if (STATE.sessionId === sessionId) resetLesson();
    else renderSessions();
    showToast("Session deleted.", "Undo", function () {
      var current = readSessions();
      current.splice(index, 0, removed);
      writeJSON(STORE.sessions, current);
      renderSessions();
    });
  }

  // ---------------------------------------------------------------------------
  // Conversation
  // ---------------------------------------------------------------------------
  function scrollToBottom(smooth) {
    window.requestAnimationFrame(function () {
      DOM.scrollArea.scrollTo({
        top: DOM.scrollArea.scrollHeight,
        behavior: smooth === false ? "auto" : "smooth"
      });
    });
  }

  function appendMessage(message, animate) {
    var wrapper = document.createElement("div");
    wrapper.className = "message" + (message.role === "user" ? " message-user" : "");
    wrapper.id = "msg-" + message.id;
    if (animate === false) wrapper.style.animation = "none";
    wrapper.innerHTML = message.role === "user"
      ? '<div class="user-bubble">' + escapeHtml(message.text) + "</div>"
      : cardHtml(message);
    DOM.messages.appendChild(wrapper);
    return wrapper;
  }

  function rerenderMessage(message) {
    var wrapper = document.getElementById("msg-" + message.id);
    if (!wrapper) return;
    wrapper.className = "message" + (message.role === "user" ? " message-user" : "");
    wrapper.innerHTML = message.role === "user"
      ? '<div class="user-bubble">' + escapeHtml(message.text) + "</div>"
      : cardHtml(message);
  }

  function cardHtml(message) {
    if (message.type === "lesson") return lessonHtml(message);
    if (message.type === "briefing") return briefingHtml(message);
    return "";
  }

  function renderThinking(title, sub) {
    var wrapper = document.createElement("div");
    wrapper.className = "message";
    wrapper.id = "thinking-indicator";
    wrapper.innerHTML =
      '<div class="thinking">' +
        '<span class="thinking-dots" aria-hidden="true"><span></span><span></span><span></span></span>' +
        '<div class="thinking-copy"><p class="thinking-title">' + escapeHtml(title) + '</p><p class="thinking-sub">' + escapeHtml(sub) + "</p></div>" +
      "</div>";
    DOM.messages.appendChild(wrapper);
    return wrapper;
  }

  function updateThinking(title, sub) {
    var el = document.getElementById("thinking-indicator");
    if (!el) return;
    el.querySelector(".thinking-title").textContent = title;
    el.querySelector(".thinking-sub").textContent = sub;
  }

  function removeThinking() {
    var el = document.getElementById("thinking-indicator");
    if (el) el.remove();
  }

  async function handleAsk(event) {
    if (event) event.preventDefault();
    var question = DOM.askInput.value.trim();
    if (!question || STATE.busy) return;

    STATE.busy = true;
    DOM.sendBtn.disabled = true;
    DOM.welcome.hidden = true;
    DOM.askInput.value = "";
    autoGrow();

    var session = getSession();
    if (!session) session = createSession(question);
    var targetSessionId = session.id;

    var userMessage = {
      id: uid("m_"),
      role: "user",
      type: "text",
      text: question,
      createdAt: new Date().toISOString()
    };
    session.messages.push(userMessage);
    session.updatedAt = userMessage.createdAt;
    saveSession(session);
    appendMessage(userMessage);
    setTopic(session.title);
    renderSessions();
    scrollToBottom();

    renderThinking("Mapping the question", "TF-IDF vectors · spherical k-means · local concept index");
    scrollToBottom();

    try {
      await wait(420);
      var mapped = UAIEngine.mapQuestion(question);

      if (mapped.known) {
        var concept = UAIEngine.getConcept(mapped.conceptId);
        if (concept) {
          removeThinking();
          var lesson = {
            id: uid("m_"),
            role: "assistant",
            type: "lesson",
            createdAt: new Date().toISOString(),
            data: {
              conceptId: concept.id,
              name: concept.name,
              domain: concept.domain,
              clusterId: mapped.clusterId,
              confidence: mapped.confidence,
              challengeIndex: 0,
              evaluation: null
            }
          };
          session = getSessionById(targetSessionId);
          if (!session) return;
          session.messages.push(lesson);
          session.conceptId = concept.id;
          session.updatedAt = lesson.createdAt;
          saveSession(session);
          if (STATE.sessionId === targetSessionId) {
            setConceptChip(concept.name);
            appendMessage(lesson);
            scrollToBottom();
          }
          renderSessions();
          STATE.busy = false;
          DOM.sendBtn.disabled = false;
          DOM.askInput.focus();
          return;
        }
      }

      await researchQuestion(question, targetSessionId);
    } catch (error) {
      console.error("Question flow failed:", error);
      removeThinking();
      showToast("Something interrupted the lookup. Try that question once more.");
    } finally {
      STATE.busy = false;
      DOM.sendBtn.disabled = false;
      DOM.askInput.focus();
    }
  }

  async function researchQuestion(question, targetSessionId) {
    var term = UAIEngine.researchQuery(question);
    updateThinking("No close match in the local index", "Reading Wikipedia for “" + term + "”…");

    var cached = getCachedResearch(question);
    var result;

    if (cached) {
      result = Object.assign({}, cached, { cached: true });
      await wait(260);
    } else {
      result = await UAIEngine.research(question);
      if (result.found) cacheResearch(question, result);
    }

    removeThinking();
    result.originalQuestion = question;
    var briefing = {
      id: uid("m_"),
      role: "assistant",
      type: "briefing",
      createdAt: new Date().toISOString(),
      data: result
    };
    var session = getSessionById(targetSessionId);
    if (!session) return;
    session.messages.push(briefing);
    session.updatedAt = briefing.createdAt;
    saveSession(session);
    if (STATE.sessionId === targetSessionId) {
      setConceptChip("Web research");
      appendMessage(briefing);
      scrollToBottom();
    }
    renderSessions();
  }

  // ---------------------------------------------------------------------------
  // Lesson sheet
  // ---------------------------------------------------------------------------
  function lessonHtml(message) {
    var concept = UAIEngine.getConcept(message.data.conceptId);
    if (!concept) return '<div class="briefing"><p class="briefing-body">This lesson is no longer in the local corpus.</p></div>';

    var index = clamp(message.data.challengeIndex || 0, 0, concept.practice_challenges.length - 1);
    var challenge = concept.practice_challenges[index];
    var evaluation = message.data.evaluation;
    var worked = concept.worked_example || {};
    var steps = worked.step_by_step || [];

    var stepsHtml = steps.map(function (step, stepIndex) {
      return (
        '<div class="step">' +
          '<span class="step-no">' + String(stepIndex + 1).padStart(2, "0") + "</span>" +
          "<div>" +
            '<p class="step-title">' + escapeHtml(step.step) + "</p>" +
            '<p class="step-reasoning">' + escapeHtml(step.reasoning) + "</p>" +
            (step.value ? '<span class="step-value">' + escapeHtml(step.value) + "</span>" : "") +
          "</div>" +
        "</div>"
      );
    }).join("");

    return (
      '<article class="lesson" data-lesson-id="' + escapeHtml(message.id) + '">' +
        '<div class="lesson-top">' +
          '<span class="lesson-kicker">' + icon("book") + " Concept lesson</span>" +
          '<span class="lesson-meta">Cluster ' + escapeHtml(message.data.clusterId || 1) + " · " + Math.round((message.data.confidence || 0.8) * 100) + "% fit</span>" +
        "</div>" +
        '<h2 class="lesson-title">' + escapeHtml(concept.name) + "</h2>" +
        '<p class="lesson-domain">' + escapeHtml(concept.domain) + " · problem " + (index + 1) + " of " + concept.practice_challenges.length + "</p>" +

        '<section class="lesson-section" id="model-' + escapeHtml(message.id) + '">' +
          '<span class="section-number">01</span>' +
          "<div>" +
            '<h3 class="section-title">The mental model</h3>' +
            '<p class="section-text">' + escapeHtml(concept.intuition) + "</p>" +
          "</div>" +
        "</section>" +

        '<section class="lesson-section">' +
          '<span class="section-number">02</span>' +
          "<div>" +
            '<h3 class="section-title">A parallel walkthrough</h3>' +
            '<p class="worked-problem">' + escapeHtml(worked.problem || "") + "</p>" +
            '<div class="step-list">' + stepsHtml + "</div>" +
            (worked.key_takeaway
              ? '<div class="takeaway">' + icon("book", "takeaway-mark") + "<span><strong>Keep this:</strong> " + escapeHtml(worked.key_takeaway) + "</span></div>"
              : "") +
          "</div>" +
        "</section>" +

        '<section class="lesson-section">' +
          '<span class="section-number">03</span>' +
          "<div>" +
            '<h3 class="section-title">Your turn</h3>' +
            challengeHtml(message, concept, challenge, evaluation) +
          "</div>" +
        "</section>" +

        '<div class="lesson-foot">' + icon("check") + "<span>Independent solving is what moves your mastery. Explanations are here to be left behind.</span></div>" +
      "</article>"
    );
  }

  function challengeHtml(message, concept, challenge, evaluation) {
    var head =
      '<div class="challenge-head">' +
        '<span class="challenge-level">' + escapeHtml(challenge.level || "practice") + "</span>" +
        '<span class="challenge-credit">' + (evaluation ? "Checked once" : "Answer, then explain the step you took") + "</span>" +
      "</div>";

    if (evaluation) {
      return (
        '<div class="challenge">' +
          head +
          '<p class="challenge-question">' + escapeHtml(challenge.question) + "</p>" +
          evaluationHtml(evaluation) +
        "</div>"
      );
    }

    return (
      '<form class="challenge challenge-form" data-message-id="' + escapeHtml(message.id) + '">' +
        head +
        '<p class="challenge-question">' + escapeHtml(challenge.question) + "</p>" +
        '<div class="challenge-fields">' +
          "<label>" +
            '<span class="field-label">Your answer</span>' +
            '<input class="challenge-input" data-answer type="text" autocomplete="off" placeholder="A number, fraction, or expression" required>' +
          "</label>" +
          "<label>" +
            '<span class="field-label">How you got there</span>' +
            '<textarea class="challenge-textarea" data-reasoning placeholder="Write the reasoning, not just the result. This is where the diagnosis happens."></textarea>' +
          "</label>" +
          '<button class="check-button" type="submit">' + icon("check") + " Check my reasoning</button>" +
        "</div>" +
      "</form>"
    );
  }

  function evaluationHtml(evaluation) {
    var correct = evaluation.correct;
    var title = correct
      ? (evaluation.awarded ? "Independent solve · +25 XP" : "Independent solve")
      : "A specific gap, not a dead end.";
    var body = correct
      ? "You reached the right value on your own. The model is starting to hold."
      : "You answered <strong>" + escapeHtml(evaluation.studentAnswer || "—") + "</strong>. The target was <strong>" + escapeHtml(evaluation.expectedAnswer) + "</strong>.";

    var diagnosis = "";
    if (!correct && evaluation.misconception) {
      diagnosis =
        '<div class="misconception-box">' +
          "<strong>" + escapeHtml(evaluation.misconception.name) + "</strong>" +
          "<p>" + escapeHtml(evaluation.misconception.diagnosis) + "</p>" +
          '<p class="remediation"><strong>Next time:</strong> ' + escapeHtml(evaluation.misconception.hint) + "</p>" +
        "</div>";
    } else if (!correct && evaluation.note) {
      diagnosis =
        '<div class="misconception-box">' +
          "<strong>What happened</strong>" +
          "<p>" + escapeHtml(evaluation.note) + "</p>" +
        "</div>";
    } else if (!correct) {
      diagnosis =
        '<div class="misconception-box">' +
          "<strong>Use the model</strong>" +
          "<p>The answer missed, but the reasoning is the useful part. Compare your path with the walkthrough above and notice where the base or sign changed.</p>" +
        "</div>";
    }

    if (!correct && evaluation.checklist && evaluation.checklist.length) {
      diagnosis +=
        '<p class="remediation"><strong>The path through it:</strong> ' +
        evaluation.checklist.map(escapeHtml).join(" · ") +
        "</p>";
    }

    var actions = "";
    if (evaluation.nextChallenge) {
      actions +=
        '<button class="next-button" type="button" data-next-challenge="' + escapeHtml(evaluation.messageId || "") + '">' +
        "Try the next variation" + icon("arrow-right") + "</button>";
    }
    actions +=
      '<button class="ghost-button" type="button" data-focus-composer>' +
      (evaluation.nextChallenge ? "Ask something else" : "Explore another concept") +
      "</button>";

    return (
      '<div class="eval-result ' + (correct ? "is-correct" : "is-wrong") + '" role="status">' +
        '<div class="eval-head">' +
          '<span class="eval-icon">' + icon(correct ? "check" : "alert") + "</span>" +
          "<div>" +
            '<p class="eval-title">' + escapeHtml(title) + "</p>" +
            '<p class="eval-body">' + body + "</p>" +
          "</div>" +
        "</div>" +
        diagnosis +
        '<div class="eval-actions">' + actions + "</div>" +
      "</div>"
    );
  }

  function submitChallenge(form) {
    var messageId = form.getAttribute("data-message-id");
    var found = findSessionAndMessage(messageId);
    var message = found.message;
    var session = found.session;
    if (!message || message.type !== "lesson" || message.data.evaluation) return;

    var answerInput = form.querySelector("[data-answer]");
    var reasoningInput = form.querySelector("[data-reasoning]");
    var answer = answerInput ? answerInput.value.trim() : "";
    var reasoning = reasoningInput ? reasoningInput.value.trim() : "";
    if (!answer) {
      if (answerInput) answerInput.focus();
      return;
    }

    var concept = UAIEngine.getConcept(message.data.conceptId);
    if (!concept) return;
    var conceptId = concept.id;
    var index = message.data.challengeIndex || 0;
    var evaluation = UAIEngine.evaluateChallenge(conceptId, index, answer, reasoning, false);
    evaluation.messageId = message.id;

    var firstCheck = !message.data.evaluation;
    if (firstCheck) {
      evaluation.awarded = Boolean(evaluation.correct);
      updateProgress(conceptId, evaluation);
    }

    message.data.evaluation = evaluation;
    if (session) {
      session.updatedAt = new Date().toISOString();
      saveSession(session);
    }

    rerenderMessage(message);
    var result = document.querySelector("#msg-" + message.id + " .eval-result");
    if (result) result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    showToast(
      evaluation.correct
        ? evaluation.awarded ? "Independent solve. 25 XP added." : "Solved independently."
        : evaluation.misconception ? "Gap diagnosed: " + evaluation.misconception.name + "." : "Gap diagnosed. Read the note below."
    );
  }

  function updateProgress(conceptId, evaluation) {
    var stats = STATE.user.stats || { xp: 0, attempted: 0, solves: 0, streak: 0 };
    stats.attempted += 1;
    if (evaluation.correct) {
      stats.xp += 25;
      stats.solves += 1;
      stats.streak += 1;
    } else {
      stats.streak = 0;
    }
    STATE.user.stats = stats;

    var mastery = STATE.user.mastery || {};
    var record = mastery[conceptId] || { score: 0, attempts: 0, solves: 0, misses: 0, last: null };
    record.score = clamp((record.score || 0) + (evaluation.correct ? 15 : -5), 0, 100);
    record.attempts = (record.attempts || 0) + 1;
    if (evaluation.correct) record.solves = (record.solves || 0) + 1;
    else record.misses = (record.misses || 0) + 1;
    record.last = new Date().toISOString();
    mastery[conceptId] = record;
    STATE.user.mastery = mastery;

    saveCurrentUser();
    updateChrome();
  }

  function nextChallenge(messageId) {
    var found = findSessionAndMessage(messageId);
    var message = found.message;
    var session = found.session;
    if (!message || message.type !== "lesson") return;
    var concept = UAIEngine.getConcept(message.data.conceptId);
    if (!concept) return;
    var next = (message.data.challengeIndex || 0) + 1;
    if (next >= concept.practice_challenges.length) return;
    message.data.challengeIndex = next;
    message.data.evaluation = null;
    if (session) {
      session.updatedAt = new Date().toISOString();
      saveSession(session);
    }
    rerenderMessage(message);
    var section = document.getElementById("msg-" + message.id);
    if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------------------------------------------------------------------------
  // Research briefing
  // ---------------------------------------------------------------------------
  function briefingHtml(message) {
    var data = message.data;

    if (!data.found) {
      var heading = data.error ? "The lookup did not complete." : "No verified answer this time.";
      var reason = data.message || "The article index had nothing close enough to summarize.";
      return (
        '<article class="briefing">' +
          '<div class="briefing-top">' +
            '<span class="research-badge">' + icon("globe") + " Sourced lookup</span>" +
            '<span class="briefing-source">' + escapeHtml(data.source || "Wikipedia") + " · " + relativeTime(message.createdAt) + "</span>" +
          "</div>" +
          '<h2 class="briefing-title">' + escapeHtml(heading) + "</h2>" +
          '<p class="briefing-body">The local library covers five concepts, so this question went outward. I only answer from a source I can point to — nothing was invented here.</p>' +
          '<div class="briefing-error"><p>' + escapeHtml(reason) + "</p>" +
            '<div class="briefing-links">' +
              '<a class="source-link is-primary" href="' + escapeHtml(data.googleUrl) + '" target="_blank" rel="noopener noreferrer">' + icon("search") + " Search Google</a>" +
              '<a class="source-link" href="' + escapeHtml(data.wikiSearchUrl) + '" target="_blank" rel="noopener noreferrer">' + icon("globe") + " Search Wikipedia</a>" +
              '<button class="source-link" type="button" data-retry-research="' + escapeHtml(message.id) + '">' + icon("refresh") + " Try again</button>" +
            "</div>" +
          "</div>" +
          '<p class="briefing-foot">Automatic research uses the English Wikipedia API. Google blocks direct page reads from browsers, so a Google search opens beside the app instead.</p>' +
        "</article>"
      );
    }

    var related = (data.related || []).map(function (item) {
      return '<a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(item.title) + "</a>";
    }).join(" · ");

    var fullUrl = escapeHtml(data.url);
    var googleSearch = escapeHtml(data.googleUrl || UAIEngine.googleUrl(data.query));
    var savedLine = data.cached
      ? "Kept in your research library · fetched " + dateLabel(data.fetchedAt)
      : "Saved to your research library";

    return (
      '<article class="briefing">' +
        '<div class="briefing-top">' +
          '<span class="research-badge">' + icon("globe") + " Researched answer</span>" +
          '<span class="briefing-source">Wikipedia' + (data.cached ? " · from library" : " · just now") + "</span>" +
        "</div>" +
        '<h2 class="briefing-title">' + escapeHtml(data.title) + "</h2>" +
        '<p class="briefing-body">' + escapeHtml(data.extract) + "</p>" +
        '<div class="briefing-media">' +
          (data.thumbnail
            ? '<img class="briefing-thumb" src="' + escapeHtml(data.thumbnail) + '" alt="Illustration for ' + escapeHtml(data.title) + '" loading="lazy" referrerpolicy="no-referrer">'
            : '<div class="briefing-thumb" aria-hidden="true"></div>') +
          '<div class="briefing-links">' +
            '<a class="source-link is-primary" href="' + fullUrl + '" target="_blank" rel="noopener noreferrer">' + icon("book") + " Read on Wikipedia</a>" +
            '<a class="source-link" href="' + googleSearch + '" target="_blank" rel="noopener noreferrer">' + icon("search") + " Open in Google</a>" +
            '<a class="source-link" href="' + escapeHtml(data.wikiSearchUrl || fullUrl) + '" target="_blank" rel="noopener noreferrer">' + icon("globe") + " Related articles</a>" +
          "</div>" +
        "</div>" +
        (related ? '<p class="briefing-related"><strong>Also worth reading</strong>' + related + "</p>" : "") +
        '<p class="briefing-foot">' + icon("check") + " " + savedLine + ". Text from Wikipedia, CC BY-SA 4.0 — read the article for the full context.</p>" +
      "</article>"
    );
  }

  async function retryResearch(messageId, button) {
    var found = findSessionAndMessage(messageId);
    var message = found.message;
    var session = found.session;
    if (!message || message.type !== "briefing") return;
    var question = message.data.originalQuestion || message.data.query;
    button.disabled = true;
    button.textContent = "Looking again…";

    var result = await UAIEngine.research(question);
    if (result.found) cacheResearch(question, result);
    result.originalQuestion = question;
    message.data = result;
    if (session) {
      session.updatedAt = new Date().toISOString();
      saveSession(session);
    }
    rerenderMessage(message);
    showToast(result.found ? "A sourced answer came back." : "Still no verified article. Google is one click away.");
  }

  // ---------------------------------------------------------------------------
  // Progress
  // ---------------------------------------------------------------------------
  function openProgress() {
    var stats = STATE.user.stats || { xp: 0, attempted: 0, solves: 0, streak: 0 };
    DOM.statXp.textContent = stats.xp || 0;
    DOM.statSolves.textContent = stats.solves || 0;
    DOM.statRate.textContent = stats.attempted ? Math.round((stats.solves / stats.attempted) * 100) + "%" : "—";
    DOM.statStreak.textContent = stats.streak || 0;

    var mastery = STATE.user.mastery || {};
    var entries = Object.keys(mastery).map(function (conceptId) {
      var concept = UAIEngine.getConcept(conceptId);
      return {
        id: conceptId,
        name: concept ? concept.name : conceptId.replace(/_/g, " "),
        record: mastery[conceptId]
      };
    }).sort(function (a, b) { return b.record.score - a.record.score; });

    DOM.masteryCaption.textContent = entries.length ? plural(entries.length, "concept") + " practiced" : "No attempts yet";

    if (!entries.length) {
      DOM.masteryList.innerHTML = '<p class="mastery-empty">Solve a practice problem and the concept will appear here with its own mastery bar.</p>';
    } else {
      DOM.masteryList.innerHTML = entries.map(function (entry) {
        var score = clamp(entry.record.score || 0, 0, 100);
        return (
          '<div class="mastery-item">' +
            '<div class="mastery-head">' +
              '<span class="mastery-name">' + escapeHtml(entry.name) + "</span>" +
              '<span class="mastery-value">' + score + "%</span>" +
            "</div>" +
            '<div class="mastery-track"><div class="mastery-fill" style="width:' + score + '%"></div></div>' +
            '<div class="mastery-meta">' +
              "<span>" + plural(entry.record.solves || 0, "independent solve") + " / " + plural(entry.record.attempts || 0, "attempt") + "</span>" +
              "<span>" + plural(entry.record.misses || 0, "gap") + " diagnosed</span>" +
            "</div>" +
          "</div>"
        );
      }).join("");
    }

    var researchCount = Object.keys(getCache()).length;
    DOM.researchSummary.textContent = researchCount
      ? plural(researchCount, "Wikipedia topic") + " in your research library. Cached briefings are reused for 30 days, then refreshed."
      : "No Wikipedia briefings yet. Questions outside the five-concept library will appear here.";

    openModal(DOM.progressModal, DOM.progressClose);
  }

  // ---------------------------------------------------------------------------
  // Accounts UI
  // ---------------------------------------------------------------------------
  function accountPanel() {
    var isDemo = STATE.user.id === DEMO_ID;
    DOM.accountPanel.hidden = isDemo;
    if (!isDemo) {
      DOM.accountName.textContent = STATE.user.username;
      DOM.accountEmail.textContent = STATE.user.email;
      DOM.accountAvatar.textContent = initial(STATE.user.username);
    }
  }

  function openAuth() {
    switchAuthTab("login");
    DOM.authMessage.textContent = "";
    DOM.authMessage.classList.remove("is-good");
    accountPanel();
    openModal(DOM.authModal, DOM.loginIdentifier);
  }

  function switchAuthTab(tab) {
    var isLogin = tab === "login";
    DOM.loginTab.classList.toggle("is-active", isLogin);
    DOM.signupTab.classList.toggle("is-active", !isLogin);
    DOM.loginTab.setAttribute("aria-selected", String(isLogin));
    DOM.signupTab.setAttribute("aria-selected", String(!isLogin));
    DOM.loginForm.hidden = !isLogin;
    DOM.signupForm.hidden = isLogin;
    DOM.authMessage.textContent = "";
  }

  async function handleLogin(event) {
    event.preventDefault();
    var identifier = DOM.loginIdentifier.value.trim().toLowerCase();
    var password = DOM.loginPassword.value;
    var submit = DOM.loginForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    DOM.authMessage.textContent = "Checking…";
    DOM.authMessage.classList.remove("is-good");

    try {
      var users = loadUsers();
      var user = users.find(function (item) {
        return item.username.toLowerCase() === identifier || item.email.toLowerCase() === identifier;
      });
      if (!user) {
        DOM.authMessage.textContent = "No local account matches that username or email.";
        return;
      }
      var digest = await hashPassword(password, user.salt);
      if (digest !== user.hash) {
        DOM.authMessage.textContent = "That password does not match.";
        return;
      }
      setCurrentUser(user);
      DOM.loginForm.reset();
      resetLesson();
      updateChrome();
      closeModal(DOM.authModal);
      showToast("Signed in as " + user.username + ".");
    } catch (error) {
      DOM.authMessage.textContent = "The local account could not be read. Try again.";
    } finally {
      submit.disabled = false;
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    var username = DOM.signupUsername.value.trim();
    var email = DOM.signupEmail.value.trim().toLowerCase();
    var password = DOM.signupPassword.value;
    var submit = DOM.signupForm.querySelector('button[type="submit"]');

    DOM.authMessage.classList.remove("is-good");
    if (username.length < 3) {
      DOM.authMessage.textContent = "Use at least three characters for the username.";
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      DOM.authMessage.textContent = "That email address does not look complete.";
      return;
    }
    if (password.length < 6) {
      DOM.authMessage.textContent = "Use at least six characters for the password.";
      return;
    }

    var users = loadUsers();
    if (users.some(function (u) { return u.username.toLowerCase() === username.toLowerCase(); })) {
      DOM.authMessage.textContent = "That username is already used on this browser.";
      return;
    }
    if (users.some(function (u) { return u.email.toLowerCase() === email; })) {
      DOM.authMessage.textContent = "That email is already used on this browser.";
      return;
    }

    submit.disabled = true;
    DOM.authMessage.textContent = "Creating the account…";
    try {
      var salt = randomSalt();
      var digest = await hashPassword(password, salt);
      var user = {
        id: uid("user_"),
        username: username,
        email: email,
        salt: salt,
        hash: digest,
        createdAt: new Date().toISOString(),
        stats: { xp: 0, attempted: 0, solves: 0, streak: 0 },
        mastery: {}
      };
      users.push(user);
      saveUsers(users);
      setCurrentUser(user);
      DOM.signupForm.reset();
      resetLesson();
      updateChrome();
      closeModal(DOM.authModal);
      showToast("Account created. Your progress stays on this device.");
    } catch (error) {
      DOM.authMessage.textContent = "The account could not be created. Try again.";
    } finally {
      submit.disabled = false;
    }
  }

  function useDemoAccount() {
    var demo = loadUsers().find(function (u) { return u.id === DEMO_ID; });
    if (!demo) return;
    setCurrentUser(demo);
    resetLesson();
    updateChrome();
    closeModal(DOM.authModal);
    showToast("Using the demo learner account.");
  }

  // ---------------------------------------------------------------------------
  // Modals, sidebar, toast
  // ---------------------------------------------------------------------------
  function openModal(modal, focusTarget) {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    if (focusTarget) setTimeout(function () { focusTarget.focus(); }, 80);
  }

  function closeModal(modal) {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  function openSidebar() {
    DOM.sidebar.classList.add("is-open");
    DOM.sidebarScrim.classList.add("is-visible");
  }

  function closeSidebar() {
    DOM.sidebar.classList.remove("is-open");
    DOM.sidebarScrim.classList.remove("is-visible");
  }

  var toastTimer = null;
  function showToast(message, actionLabel, action) {
    clearTimeout(toastTimer);
    DOM.toastText.textContent = message;
    DOM.toastAction.hidden = !actionLabel;
    DOM.toastAction.textContent = actionLabel || "";
    DOM.toastAction.onclick = null;
    if (actionLabel && action) {
      DOM.toastAction.onclick = function () {
        action();
        hideToast();
      };
    }
    DOM.toast.hidden = false;
    window.requestAnimationFrame(function () { DOM.toast.classList.add("is-visible"); });
    toastTimer = setTimeout(hideToast, actionLabel ? 7000 : 4200);
  }

  function hideToast() {
    DOM.toast.classList.remove("is-visible");
    setTimeout(function () { DOM.toast.hidden = true; }, 220);
  }

  // ---------------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------------
  function cacheDom() {
    [
      "sidebar", "sidebarScrim", "menuBtn", "closeSidebarBtn", "brandHome", "newSessionBtn",
      "sessionList", "engineCount", "profileBtn", "userAvatar", "userDisplayName", "userMeta",
      "activeTopic", "conceptChip", "conceptChipText", "xpBadge", "analyticsBtn", "scrollArea",
      "welcome", "messages", "askForm", "askInput", "sendBtn", "authModal", "authClose",
      "accountPanel", "accountName", "accountEmail", "accountAvatar", "signOutBtn",
      "loginTab", "signupTab", "loginForm", "signupForm", "loginIdentifier", "loginPassword",
      "signupUsername", "signupEmail", "signupPassword", "authMessage", "demoFillBtn",
      "progressModal", "progressClose", "statXp", "statSolves", "statRate", "statStreak",
      "masteryCaption", "masteryList", "researchSummary", "toast", "toastText", "toastAction"
    ].forEach(function (id) { DOM[id] = document.getElementById(id); });
  }

  function bindEvents() {
    DOM.askForm.addEventListener("submit", handleAsk);
    DOM.askInput.addEventListener("input", autoGrow);
    DOM.askInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        DOM.askForm.requestSubmit();
      }
    });

    document.querySelectorAll("[data-question]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (STATE.busy) return;
        DOM.askInput.value = button.getAttribute("data-question");
        autoGrow();
        DOM.askForm.requestSubmit();
      });
    });

    DOM.newSessionBtn.addEventListener("click", resetLesson);
    DOM.brandHome.addEventListener("click", function (event) {
      event.preventDefault();
      resetLesson();
    });

    DOM.menuBtn.addEventListener("click", openSidebar);
    DOM.closeSidebarBtn.addEventListener("click", closeSidebar);
    DOM.sidebarScrim.addEventListener("click", closeSidebar);

    DOM.sessionList.addEventListener("click", function (event) {
      var deleteButton = event.target.closest("[data-delete-session]");
      if (deleteButton) {
        event.stopPropagation();
        deleteSession(deleteButton.getAttribute("data-delete-session"));
        return;
      }
      var item = event.target.closest("[data-session-id]");
      if (item) openSession(item.getAttribute("data-session-id"));
    });

    DOM.profileBtn.addEventListener("click", openAuth);
    DOM.authClose.addEventListener("click", function () { closeModal(DOM.authModal); });
    DOM.loginTab.addEventListener("click", function () { switchAuthTab("login"); });
    DOM.signupTab.addEventListener("click", function () { switchAuthTab("signup"); });
    DOM.loginForm.addEventListener("submit", handleLogin);
    DOM.signupForm.addEventListener("submit", handleSignup);
    DOM.demoFillBtn.addEventListener("click", useDemoAccount);
    DOM.signOutBtn.addEventListener("click", useDemoAccount);

    DOM.analyticsBtn.addEventListener("click", openProgress);
    DOM.progressClose.addEventListener("click", function () { closeModal(DOM.progressModal); });

    document.querySelectorAll("[data-close-modal]").forEach(function (target) {
      target.addEventListener("click", function () {
        var modal = document.getElementById(target.getAttribute("data-close-modal"));
        if (modal) closeModal(modal);
      });
    });

    DOM.messages.addEventListener("submit", function (event) {
      var form = event.target.closest(".challenge-form");
      if (!form) return;
      event.preventDefault();
      submitChallenge(form);
    });

    DOM.messages.addEventListener("click", function (event) {
      var next = event.target.closest("[data-next-challenge]");
      if (next) {
        nextChallenge(next.getAttribute("data-next-challenge"));
        return;
      }
      var focusComposer = event.target.closest("[data-focus-composer]");
      if (focusComposer) {
        DOM.askInput.focus();
        return;
      }
      var retry = event.target.closest("[data-retry-research]");
      if (retry) {
        retryResearch(retry.getAttribute("data-retry-research"), retry);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (DOM.authModal.classList.contains("is-open")) closeModal(DOM.authModal);
        if (DOM.progressModal.classList.contains("is-open")) closeModal(DOM.progressModal);
        closeSidebar();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        resetLesson();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 900) closeSidebar();
    });
  }

  function init() {
    cacheDom();
    if (!window.UAIEngine) {
      document.body.innerHTML = '<p style="padding:40px;font-family:system-ui">The local engine could not load. Check that js/data.js and js/engine.js are beside index.html.</p>';
      return;
    }

    var users = loadUsers();
    var savedId = readJSON(STORE.current, DEMO_ID);
    var savedUser = users.find(function (user) { return user.id === savedId; });
    STATE.user = savedUser || users.find(function (user) { return user.id === DEMO_ID; }) || users[0];
    writeJSON(STORE.current, STATE.user.id);

    bindEvents();
    updateChrome();
    renderSessions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
