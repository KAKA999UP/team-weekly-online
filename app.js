import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.TEAM_WIDGET_CONFIG || {};
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

let state = {
  members: [],
  leaderPlans: [],
  memberPlans: [],
  checkins: [],
  awards: [],
  dedicatedTasks: [],
  suggestions: [],
  accounts: [],
};
let currentEmployee = JSON.parse(localStorage.getItem("tddCurrentEmployee") || "null");
let leaderCode = sessionStorage.getItem("teamWeeklyLeaderCode") || "";
let leaderWeekFilter = localStorage.getItem("tddLeaderWeekFilter") || currentWeek();
let editorMode = "add";
let pendingAvatarData = "";

const $ = (id) => document.getElementById(id);

const quotes = [
  "小步快跑，也是在靠近目标。",
  "今天完成一点点，周五就轻松一点点。",
  "行动会带来清晰，完成会带来自信。",
  "把计划写下来，把结果做出来。",
  "稳定推进的人，最后最有力量。",
  "响应快一点，协作就顺一点。",
  "完成一项，就是给未来的自己减负。",
];

function currentWeek() {
  const d = new Date();
  const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  sunday.setDate(sunday.getDate() - sunday.getDay());
  const firstSunday = new Date(sunday.getFullYear(), 0, 1);
  firstSunday.setDate(firstSunday.getDate() - firstSunday.getDay());
  const week = Math.floor((sunday - firstSunday) / 604800000) + 1;
  return `${sunday.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.remove("show"), 2600);
}

function showQuote() {
  $("quoteBox").textContent = quotes[Math.floor(Math.random() * quotes.length)];
  $("quoteBox").classList.remove("hidden");
}

function parseTodos(raw) {
  return raw
    .split(/\n+/)
    .map((line) => line.trim().replace(/^\d+\.\s*/, ""))
    .filter(Boolean);
}

function activeMember() {
  if (!currentEmployee) return null;
  return state.members.find((m) => Number(m.id) === Number(currentEmployee.id)) || currentEmployee;
}

function hashString(value) {
  return String(value || "")
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function memberDisplayName(member) {
  return member?.nickname || member?.name || "成员";
}

function memberUsername(member) {
  return member?.username || currentEmployee?.username || "未设置";
}

function avatarFor(member) {
  if (member?.avatar_data) return member.avatar_data;
  const animals = ["🐼", "🐱", "🐶", "🦊", "🐰", "🐻", "🐨", "🐯", "🦁", "🐵"];
  const colors = ["#fff3bf", "#dbeafe", "#dcfce7", "#fce7f3", "#ede9fe", "#cffafe", "#ffedd5", "#e0f2fe"];
  const seed = hashString(member?.id || member?.username || member?.name || "tdd");
  const animal = animals[seed % animals.length];
  const bg = colors[seed % colors.length];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <rect width="120" height="120" rx="60" fill="${bg}"/>
      <circle cx="36" cy="32" r="14" fill="#ffffff" opacity="0.72"/>
      <circle cx="88" cy="88" r="18" fill="#ffffff" opacity="0.56"/>
      <text x="60" y="76" text-anchor="middle" font-size="54" font-family="Segoe UI Emoji, Apple Color Emoji, Arial">${animal}</text>
    </svg>
  `;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function applyMemberBackground(member) {
  const color = member?.bg_color || "#f6f7fb";
  document.documentElement.style.setProperty("--bg", color);
}

function memberPoints(memberId) {
  const plans = state.memberPlans.filter((p) => Number(p.member_id) === Number(memberId));
  const checkins = state.checkins.filter((c) => Number(c.member_id) === Number(memberId));
  const awards = state.awards.filter((a) => Number(a.member_id) === Number(memberId));
  return plans.reduce((sum, p) => sum + Number(p.points || 0), 0)
    + checkins.reduce((sum, c) => sum + Number(c.points || 0), 0)
    + awards.reduce((sum, a) => sum + Number(a.points || 0), 0);
}

function memberById(id) {
  return state.members.find((m) => Number(m.id) === Number(id));
}

function checkinsForWeek(memberId, week) {
  const planIds = new Set(state.leaderPlans.filter((p) => p.week === week).map((p) => Number(p.id)));
  return state.checkins.filter((c) => Number(c.member_id) === Number(memberId) && planIds.has(Number(c.leader_plan_id)));
}

async function loadAll() {
  const [members, leaderPlans, memberPlans, checkins, awards, dedicatedTasks, suggestions] = await Promise.all([
    supabase.from("members").select("id,name,username,nickname,avatar_data,bg_color,created_at").order("name"),
    supabase.from("leader_plans").select("*").order("created_at", { ascending: false }),
    supabase.from("member_plans").select("*").order("created_at", { ascending: true }),
    supabase.from("checkins").select("*").order("created_at", { ascending: false }),
    supabase.from("point_awards").select("*").order("created_at", { ascending: false }),
    supabase.from("dedicated_tasks").select("*").order("created_at", { ascending: true }),
    supabase.from("suggestions").select("*").order("created_at", { ascending: false }),
  ]);
  for (const result of [members, leaderPlans, memberPlans, checkins, awards, dedicatedTasks, suggestions]) {
    if (result.error) throw result.error;
  }
  state.members = members.data || [];
  state.leaderPlans = leaderPlans.data || [];
  state.memberPlans = memberPlans.data || [];
  state.checkins = checkins.data || [];
  state.awards = awards.data || [];
  state.dedicatedTasks = dedicatedTasks.data || [];
  state.suggestions = suggestions.data || [];
  if (leaderCode) await loadLeaderAccounts();
  render();
}

async function loadLeaderAccounts() {
  const { data, error } = await supabase.rpc("leader_accounts", { p_code: leaderCode });
  if (!error) state.accounts = data || [];
}

function renderEmployee() {
  const member = activeMember();
  if (currentEmployee) {
    $("currentEmployee").textContent = memberDisplayName(member);
    $("currentEmployeeMeta").textContent = `用户名：${memberUsername(member)}　员工名：${member?.name || currentEmployee.name || "未设置"}`;
    $("logoutBtn").classList.remove("hidden");
    $("changePasswordBtn").classList.remove("hidden");
    $("profilePanel").classList.remove("hidden");
    $("employeeLoginBtn").textContent = "切换成员";
    $("avatarPreview").src = avatarFor(member);
    $("nicknameInput").value = member?.nickname || "";
    $("bgColorInput").value = member?.bg_color || "#f6f7fb";
    applyMemberBackground(member);
  } else {
    $("currentEmployee").textContent = "未登录";
    $("currentEmployeeMeta").textContent = "成员账号由 Leader 创建。登录后可提交计划、完成任务和打卡。";
    $("logoutBtn").classList.add("hidden");
    $("changePasswordBtn").classList.add("hidden");
    $("profilePanel").classList.add("hidden");
    $("employeeLoginBtn").textContent = "成员登录";
    $("avatarPreview").src = avatarFor(null);
    applyMemberBackground(null);
  }
}

function renderMyPlans() {
  const member = activeMember();
  const week = currentWeek();
  const plans = member ? state.memberPlans.filter((p) => Number(p.member_id) === Number(member.id) && p.week === week) : [];
  const done = plans.filter((p) => p.completed).length;
  const pct = plans.length ? Math.round((done / plans.length) * 100) : 0;
  $("completionText").textContent = `${pct}% (${done}/${plans.length})`;
  $("completionBar").style.width = `${pct}%`;
  $("myPoints").textContent = member ? memberPoints(member.id) : 0;

  if (!member) {
    $("myPlans").innerHTML = `<div class="item meta">请先点击“成员登录”。</div>`;
    return;
  }
  if (!plans.length) {
    $("myPlans").innerHTML = `<div class="item meta">本周还没有自己设置的计划。</div>`;
    return;
  }
  $("myPlans").innerHTML = plans
    .map((plan, index) => `
      <article class="item todo-item ${plan.completed ? "done" : ""}">
        <div>
          <strong>${index + 1}. ${escapeHtml(plan.title)}</strong>
          <div class="meta">${plan.completed ? "已完成" : "未完成"} · +${Number(plan.points || 0)}</div>
        </div>
        <button class="${plan.completed ? "" : "primary"}" data-complete="${plan.id}">
          ${plan.completed ? "撤回" : "完成"}
        </button>
      </article>
    `)
    .join("");
}

function renderLeaderPlans() {
  const member = activeMember();
  const plans = state.leaderPlans.filter((plan) => plan.week === currentWeek());
  if (!plans.length) {
    $("leaderPlans").innerHTML = `<div class="item meta">Leader 还没有发布本周计划。</div>`;
    return;
  }
  $("leaderPlans").innerHTML = plans
    .map((plan) => {
      const checked = member && state.checkins.find((c) => Number(c.member_id) === Number(member.id) && Number(c.leader_plan_id) === Number(plan.id));
      return `
        <article class="item ${checked ? "done" : ""}">
          <strong>${escapeHtml(plan.title)}</strong>
          <div class="meta">${escapeHtml(plan.week)}</div>
          <p>${escapeHtml(plan.details).replaceAll("\n", "<br>")}</p>
          ${
            checked
              ? `<div class="meta">已打卡 · +${checked.points}</div>`
              : `<button class="primary" data-checkin="${plan.id}">响应打卡</button>`
          }
        </article>
      `;
    })
    .join("");
}

function renderDedicatedTasks() {
  const member = activeMember();
  if (!member) {
    $("dedicatedTasks").innerHTML = `<div class="item meta">登录后可查看 Leader 给你的专属任务。</div>`;
    return;
  }
  const tasks = state.dedicatedTasks.filter((t) => Number(t.member_id) === Number(member.id) && t.week === currentWeek());
  if (!tasks.length) {
    $("dedicatedTasks").innerHTML = `<div class="item meta">暂无专属任务。</div>`;
    return;
  }
  $("dedicatedTasks").innerHTML = tasks.map((task) => `
    <article class="item todo-item ${task.completed ? "done" : ""}">
      <div>
        <strong>${escapeHtml(task.title)}</strong>
        <div class="meta">${escapeHtml(task.details || "")}</div>
      </div>
      <button class="${task.completed ? "" : "primary"}" data-task-complete="${task.id}">
        ${task.completed ? "撤回" : "完成"}
      </button>
    </article>
  `).join("");
}

function renderPlanSelect() {
  const plans = state.leaderPlans.filter((plan) => plan.week === leaderWeekFilter);
  $("planSelect").innerHTML = plans
    .map((plan) => `<option value="${plan.id}">${escapeHtml(plan.title)}</option>`)
    .join("") || `<option value="">本周暂无计划</option>`;
}

function renderAccounts() {
  $("accountList").innerHTML = state.accounts
    .map((a) => `
      <article class="item account-item">
        <div class="profile-row">
          <img class="avatar small-avatar" src="${avatarFor(a)}" alt="头像" />
          <div>
            <strong>${escapeHtml(a.name || "未命名成员")}</strong>
            <div class="meta">用户名：${escapeHtml(a.username || "未设置")} · 密码：${escapeHtml(a.password_plain || "未设置")} · 积分：${memberPoints(a.member_id)}</div>
            <div class="meta">成员昵称：${escapeHtml(a.nickname || "未设置")} · Leader 备注：${escapeHtml(a.leader_remark || "无")}</div>
          </div>
        </div>
        <div class="account-actions">
          <button data-edit-account="${a.member_id}">修改</button>
          <button class="danger" data-delete-member="${a.member_id}">删除</button>
        </div>
      </article>
    `)
    .join("") || `<div class="item meta">暂无成员账号。</div>`;
}

function renderLeaderProgress() {
  $("progressBoard").innerHTML = state.members
    .map((member) => {
      const plans = state.memberPlans.filter((p) => Number(p.member_id) === Number(member.id) && p.week === leaderWeekFilter);
      const done = plans.filter((p) => p.completed).length;
      const pct = plans.length ? Math.round((done / plans.length) * 100) : 0;
      const checkins = checkinsForWeek(member.id, leaderWeekFilter);
      const tasks = state.dedicatedTasks.filter((t) => Number(t.member_id) === Number(member.id) && t.week === leaderWeekFilter);
      const taskDone = tasks.filter((t) => t.completed).length;
      return `
        <article class="item">
          <div class="profile-row">
            <img class="avatar" src="${avatarFor(member)}" alt="头像" />
            <div>
              <strong>${escapeHtml(memberDisplayName(member))}</strong>
              <div class="meta">用户名：${escapeHtml(member.username || "未设置")} · 员工名：${escapeHtml(member.name)}</div>
              <div class="meta">自定计划 ${done}/${plans.length} · ${pct}% · 打卡 ${checkins.length} 次 · 专属任务 ${taskDone}/${tasks.length} · 总积分 ${memberPoints(member.id)}</div>
            </div>
          </div>
          <div class="progress"><span style="width:${pct}%"></span></div>
          <div class="meta">成员计划：${plans.map((p) => `${p.completed ? "✓" : "□"} ${escapeHtml(p.title)}`).join("；") || "暂无"}</div>
          <div class="meta">专属任务：${tasks.map((t) => `${t.completed ? "✓" : "□"} ${escapeHtml(t.title)}`).join("；") || "暂无"}</div>
        </article>
      `;
    })
    .join("") || `<div class="item meta">暂无进度。</div>`;
}

function renderSuggestions() {
  const suggestions = state.suggestions.filter((item) => (item.week || currentWeek()) === leaderWeekFilter);
  $("suggestionList").innerHTML = suggestions
    .map((item) => {
      const member = memberById(item.member_id);
      const time = new Date(item.created_at).toLocaleString("zh-CN");
      return `
        <article class="item">
          <strong>${escapeHtml(memberDisplayName(member))}</strong>
          <div class="meta">${escapeHtml(member?.username || "")} · ${time}</div>
          <p>${escapeHtml(item.message).replaceAll("\n", "<br>")}</p>
        </article>
      `;
    })
    .join("") || `<div class="item meta">这一周暂无成员建议。</div>`;
}

function renderRanking() {
  const ranked = [...state.members]
    .map((member) => ({ member, points: memberPoints(member.id) }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 8);

  $("memberRanking").innerHTML = ranked
    .map((row, index) => `
      <article class="rank-card rank-${index + 1}">
        <div class="rank-badge">${index + 1}</div>
        <img class="avatar" src="${avatarFor(row.member)}" alt="头像" />
        <div>
          <strong>${escapeHtml(memberDisplayName(row.member))}</strong>
          <div class="meta">用户名：${escapeHtml(row.member.username || "未设置")}</div>
        </div>
        <div class="rank-points">${row.points}<span>分</span></div>
      </article>
    `)
    .join("") || `<div class="item meta">暂无成员积分。</div>`;
}

function renderLeader() {
  const memberOptions = state.members
    .map((m) => `<option value="${m.id}">${escapeHtml(memberDisplayName(m))}（${escapeHtml(m.username || "无用户名")}）</option>`)
    .join("");
  $("rewardMember").innerHTML = memberOptions;
  $("taskMember").innerHTML = memberOptions;
  $("queryWeek").value = leaderWeekFilter;
  renderPlanSelect();
  renderAccounts();
  renderLeaderProgress();
  renderSuggestions();
}

function render() {
  $("weekLabel").textContent = currentWeek();
  renderEmployee();
  renderMyPlans();
  renderLeaderPlans();
  renderDedicatedTasks();
  renderLeader();
  renderRanking();
}

async function submitTodos() {
  const member = activeMember();
  if (!member) return toast("请先登录成员账号。");
  const todos = parseTodos($("todoInput").value);
  if (!todos.length) return toast("请至少填写一条 Todo。");
  if (todos.length > 5) return toast("我的本周计划最多设置 5 条，请精简一下。");
  const oldPlans = state.memberPlans.filter((p) => Number(p.member_id) === Number(member.id) && p.week === currentWeek());
  if (editorMode === "edit") {
    await Promise.all(oldPlans.map((p) => supabase.from("member_plans").delete().eq("id", p.id)));
  }
  const rows = todos.map((todo) => ({
    member_id: member.id,
    week: currentWeek(),
    title: todo,
    details: todo,
  }));
  const { error } = await supabase.from("member_plans").insert(rows);
  if (error) return toast(error.message);
  $("todoInput").value = "1. ";
  $("planEditor").classList.add("hidden");
  editorMode = "add";
  showQuote();
  await loadAll();
  toast("计划已保存。");
}

async function completePlan(id) {
  const plan = state.memberPlans.find((p) => Number(p.id) === Number(id));
  if (!plan) return;
  if (plan.completed) {
    const { error } = await supabase.from("member_plans").update({ completed: false, completed_at: null, points: 0 }).eq("id", plan.id);
    if (error) return toast(error.message);
  } else {
    const earnedPlanCount = state.memberPlans.filter((p) =>
      Number(p.member_id) === Number(plan.member_id)
      && p.week === plan.week
      && p.completed
      && Number(p.points || 0) > 0
    ).length;
    const points = earnedPlanCount >= 5 ? 0 : 1;
    const { error } = await supabase.from("member_plans").update({
      completed: true,
      completed_at: new Date().toISOString(),
      points,
    }).eq("id", plan.id);
    if (error) return toast(error.message);
    toast(points ? "完成计划，获得 1 分。" : "完成计划。本周计划积分已达 5 分上限。");
  }
  await loadAll();
}

async function completeDedicatedTask(id) {
  const task = state.dedicatedTasks.find((t) => Number(t.id) === Number(id));
  if (!task) return;
  const { error } = await supabase.from("dedicated_tasks").update({
    completed: !task.completed,
    completed_at: task.completed ? null : new Date().toISOString(),
  }).eq("id", task.id);
  if (error) return toast(error.message);
  await loadAll();
}

async function checkin(planId) {
  const member = activeMember();
  if (!member) return toast("请先登录成员账号。");
  const points = Math.floor(Math.random() * 6);
  const { error } = await supabase.from("checkins").insert({
    member_id: member.id,
    leader_plan_id: Number(planId),
    note: "已响应打卡",
    points,
  });
  if (error) return toast(error.message);
  await loadAll();
  toast(`打卡成功，随机获得 ${points} 分。`);
}

async function publishPlan() {
  const title = $("leaderTitle").value.trim();
  const details = $("leaderDetails").value.trim();
  if (!title || !details) return toast("请填写标题和内容。");
  const { error } = await supabase.rpc("leader_create_plan", {
    p_code: leaderCode,
    p_week: leaderWeekFilter || currentWeek(),
    p_title: title,
    p_details: details,
  });
  if (error) return toast(error.message);
  $("leaderTitle").value = "";
  $("leaderDetails").value = "";
  await loadAll();
  toast("计划已发布。");
}

function loadPlanForEdit() {
  const plan = state.leaderPlans.find((p) => Number(p.id) === Number($("planSelect").value));
  if (!plan) return toast("请选择一个已有计划。");
  $("leaderTitle").value = plan.title;
  $("leaderDetails").value = plan.details;
  toast("已载入，可以修改后点“保存修改”。");
}

async function updatePlan() {
  const planId = Number($("planSelect").value);
  const title = $("leaderTitle").value.trim();
  const details = $("leaderDetails").value.trim();
  if (!planId) return toast("请选择要修改的计划。");
  if (!title || !details) return toast("请填写标题和内容。");
  const { error } = await supabase.rpc("leader_update_plan", {
    p_code: leaderCode,
    p_plan_id: planId,
    p_week: leaderWeekFilter || currentWeek(),
    p_title: title,
    p_details: details,
  });
  if (error) return toast(error.message);
  await loadAll();
  toast("计划已修改。");
}

async function deletePlan() {
  const planId = Number($("planSelect").value);
  if (!planId) return toast("请选择要删除的计划。");
  const plan = state.leaderPlans.find((p) => Number(p.id) === planId);
  const ok = confirm(`确定删除“${plan?.title || "选中计划"}”吗？相关成员打卡也会一起删除。`);
  if (!ok) return;
  const { error } = await supabase.rpc("leader_delete_plan", {
    p_code: leaderCode,
    p_plan_id: planId,
  });
  if (error) return toast(error.message);
  $("leaderTitle").value = "";
  $("leaderDetails").value = "";
  await loadAll();
  toast("计划已删除。");
}

async function createAccount() {
  const name = $("newMemberName").value.trim();
  const username = $("newUsername").value.trim();
  const password = $("newPassword").value.trim();
  const { error } = await supabase.rpc("leader_create_member_account", {
    p_code: leaderCode,
    p_name: name,
    p_username: username,
    p_password: password,
  });
  if (error) return toast(error.message);
  $("newMemberName").value = "";
  $("newUsername").value = "";
  $("newPassword").value = "";
  await loadAll();
  toast("成员账号已创建/重置。");
}

async function editAccount(memberId) {
  const account = state.accounts.find((a) => Number(a.member_id) === Number(memberId));
  if (!account) return;
  const name = prompt("员工名字", account.name || "");
  if (name === null) return;
  const username = prompt("成员用户名", account.username || "");
  if (username === null) return;
  const remark = prompt("Leader 私有备注（成员端看不到）", account.leader_remark || "");
  if (remark === null) return;
  const password = prompt("新密码（不修改请留空）", "");
  if (password === null) return;
  const { error } = await supabase.rpc("leader_update_member_account", {
    p_code: leaderCode,
    p_member_id: Number(memberId),
    p_name: name,
    p_username: username,
    p_password: password,
    p_leader_remark: remark,
  });
  if (error) return toast(error.message);
  await loadAll();
  toast("成员账号已修改。");
}

async function deleteMember(memberId) {
  const account = state.accounts.find((a) => Number(a.member_id) === Number(memberId));
  const ok = confirm(`确定删除成员“${account?.name || memberId}”吗？删除后 TA 的计划、打卡、积分记录也会一起删除。`);
  if (!ok) return;
  const { error } = await supabase.rpc("leader_delete_member", {
    p_code: leaderCode,
    p_member_id: Number(memberId),
  });
  if (error) return toast(error.message);
  await loadAll();
  toast("成员已删除。");
}

async function assignTask() {
  const memberId = Number($("taskMember").value);
  const title = $("taskTitle").value.trim();
  const details = $("taskDetails").value.trim();
  if (!memberId || !title) return toast("请选择成员并填写任务标题。");
  const { error } = await supabase.rpc("leader_create_dedicated_task", {
    p_code: leaderCode,
    p_member_id: memberId,
    p_week: leaderWeekFilter || currentWeek(),
    p_title: title,
    p_details: details,
  });
  if (error) return toast(error.message);
  $("taskTitle").value = "";
  $("taskDetails").value = "";
  await loadAll();
  toast("专属任务已分配。");
}

async function adjustPoints() {
  const memberId = Number($("rewardMember").value);
  const points = Number($("rewardPoints").value);
  const reason = $("rewardReason").value.trim() || "Leader 调整";
  if (!memberId || !points) return toast("请选择成员并填写非 0 积分。");
  const { error } = await supabase.rpc("leader_adjust_points", {
    p_code: leaderCode,
    p_member_id: memberId,
    p_points: points,
    p_reason: reason,
  });
  if (error) return toast(error.message);
  $("rewardPoints").value = "";
  $("rewardReason").value = "";
  await loadAll();
  toast("积分已调整。");
}

async function employeeLogin() {
  const username = $("employeeUsername").value.trim();
  const password = $("employeePassword").value;
  const { data, error } = await supabase.rpc("employee_login", {
    p_username: username,
    p_password: password,
  });
  if (error) return toast(error.message);
  currentEmployee = data[0];
  localStorage.setItem("tddCurrentEmployee", JSON.stringify(currentEmployee));
  $("employeeModal").classList.add("hidden");
  await loadAll();
  toast("登录成功。");
}

function resizeAvatar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("头像读取失败"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("头像格式不支持"));
      image.onload = () => {
        const size = 180;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const side = Math.min(image.width, image.height);
        const sx = (image.width - side) / 2;
        const sy = (image.height - side) / 2;
        ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function saveProfile() {
  const member = activeMember();
  if (!member) return toast("请先登录成员账号。");
  const { error } = await supabase.rpc("member_update_profile", {
    p_member_id: Number(member.id),
    p_nickname: $("nicknameInput").value.trim(),
    p_avatar_data: pendingAvatarData || member.avatar_data || null,
    p_bg_color: $("bgColorInput").value || "#f6f7fb",
  });
  if (error) return toast(error.message);
  pendingAvatarData = "";
  await loadAll();
  toast("页面设置已保存。");
}

async function submitSuggestion() {
  const member = activeMember();
  const message = $("suggestionText").value.trim();
  if (!member) return toast("请先登录成员账号。");
  if (!message) return toast("请先填写建议内容。");
  const { error } = await supabase.from("suggestions").insert({
    member_id: Number(member.id),
    week: currentWeek(),
    message,
  });
  if (error) return toast(error.message);
  $("suggestionText").value = "";
  await loadAll();
  toast("建议已提交，Leader 可以查看。");
}

async function changePassword() {
  if (!currentEmployee) return toast("请先登录。");
  const oldPassword = $("oldPassword").value;
  const newPassword = $("newPasswordSelf").value;
  const { error } = await supabase.rpc("employee_change_password", {
    p_member_id: Number(currentEmployee.id),
    p_old_password: oldPassword,
    p_new_password: newPassword,
  });
  if (error) return toast(error.message);
  $("oldPassword").value = "";
  $("newPasswordSelf").value = "";
  $("passwordModal").classList.add("hidden");
  await loadAll();
  toast("密码已修改。");
}

document.addEventListener("click", async (event) => {
  const completeId = event.target.dataset.complete;
  const checkinId = event.target.dataset.checkin;
  const taskId = event.target.dataset.taskComplete;
  const editId = event.target.dataset.editAccount;
  const deleteId = event.target.dataset.deleteMember;
  if (completeId) await completePlan(completeId);
  if (checkinId) await checkin(checkinId);
  if (taskId) await completeDedicatedTask(taskId);
  if (editId) await editAccount(editId);
  if (deleteId) await deleteMember(deleteId);
});

$("addPlanBtn").addEventListener("click", () => {
  editorMode = "add";
  $("todoInput").value = "1. ";
  $("submitTodos").textContent = "提交计划";
  $("planEditor").classList.remove("hidden");
});

$("editPlanBtn").addEventListener("click", () => {
  const member = activeMember();
  if (!member) return toast("请先登录成员账号。");
  const plans = state.memberPlans.filter((p) => Number(p.member_id) === Number(member.id) && p.week === currentWeek());
  $("todoInput").value = plans.length
    ? plans.map((p, index) => `${index + 1}. ${p.title}`).join("\n")
    : "1. ";
  editorMode = "edit";
  $("submitTodos").textContent = "保存修改";
  $("planEditor").classList.remove("hidden");
});

$("showPlanBtn").addEventListener("click", () => $("planEditor").classList.add("hidden"));
$("submitTodos").addEventListener("click", submitTodos);
$("submitSuggestion").addEventListener("click", submitSuggestion);
$("publishPlan").addEventListener("click", publishPlan);
$("loadPlanForEdit").addEventListener("click", loadPlanForEdit);
$("updatePlan").addEventListener("click", updatePlan);
$("deletePlan").addEventListener("click", deletePlan);
$("createAccount").addEventListener("click", createAccount);
$("assignTask").addEventListener("click", assignTask);
$("giveReward").addEventListener("click", adjustPoints);
$("applyWeek").addEventListener("click", () => {
  leaderWeekFilter = $("queryWeek").value.trim() || currentWeek();
  localStorage.setItem("tddLeaderWeekFilter", leaderWeekFilter);
  render();
  toast(`已切换到 ${leaderWeekFilter}`);
});

$("employeeLoginBtn").addEventListener("click", () => $("employeeModal").classList.remove("hidden"));
$("cancelEmployee").addEventListener("click", () => $("employeeModal").classList.add("hidden"));
$("confirmEmployee").addEventListener("click", employeeLogin);
$("changePasswordBtn").addEventListener("click", () => $("passwordModal").classList.remove("hidden"));
$("cancelChangePassword").addEventListener("click", () => $("passwordModal").classList.add("hidden"));
$("confirmChangePassword").addEventListener("click", changePassword);
$("logoutBtn").addEventListener("click", () => {
  currentEmployee = null;
  localStorage.removeItem("tddCurrentEmployee");
  pendingAvatarData = "";
  render();
  toast("已退出成员账号。");
});

$("bgColorInput").addEventListener("input", () => {
  document.documentElement.style.setProperty("--bg", $("bgColorInput").value);
});
$("avatarInput").addEventListener("change", async () => {
  const file = $("avatarInput").files[0];
  if (!file) return;
  try {
    pendingAvatarData = await resizeAvatar(file);
    $("avatarPreview").src = pendingAvatarData;
  } catch (error) {
    toast(error.message);
  }
});
$("saveProfile").addEventListener("click", saveProfile);

$("leaderLoginBtn").addEventListener("click", () => $("loginModal").classList.remove("hidden"));
$("cancelLogin").addEventListener("click", () => $("loginModal").classList.add("hidden"));
$("confirmLogin").addEventListener("click", async () => {
  const code = $("leaderCode").value;
  const { data, error } = await supabase.rpc("is_leader", { p_code: code });
  if (error || !data) return toast("leader 密码不正确。");
  leaderCode = code;
  sessionStorage.setItem("teamWeeklyLeaderCode", code);
  await loadLeaderAccounts();
  $("loginModal").classList.add("hidden");
  $("memberView").classList.remove("active");
  $("leaderView").classList.add("active");
  $("memberViewBtn").classList.remove("hidden");
  render();
});

$("memberViewBtn").addEventListener("click", () => {
  $("leaderView").classList.remove("active");
  $("memberView").classList.add("active");
  $("memberViewBtn").classList.add("hidden");
});

if (!config.SUPABASE_URL || config.SUPABASE_URL.includes("YOUR_PROJECT")) {
  toast("请先填写 config.js 里的 Supabase 配置。");
} else {
  loadAll().catch((error) => toast(error.message));
}
