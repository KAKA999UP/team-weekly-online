import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.TEAM_WIDGET_CONFIG || {};
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

let state = {
  members: [],
  leaderPlans: [],
  memberPlans: [],
  checkins: [],
  awards: [],
};
let currentEmployee = JSON.parse(localStorage.getItem("tddCurrentEmployee") || "null");
let leaderCode = sessionStorage.getItem("teamWeeklyLeaderCode") || "";
let editorMode = "add";
let employeeMode = "login";

const $ = (id) => document.getElementById(id);

const quotes = [
  "小步快跑，也是在靠近目标。",
  "今天完成一点点，周五就轻松一点点。",
  "行动会带来清晰，完成会带来自信。",
  "把计划写下来，把结果做出来。",
  "稳稳推进的人，最后最有力量。",
  "响应快一点，协作就顺一点。",
  "完成一项，就是给未来的自己减负。",
];

function currentWeek() {
  const d = new Date();
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
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

function randomQuote() {
  return quotes[Math.floor(Math.random() * quotes.length)];
}

function showQuote() {
  $("quoteBox").textContent = randomQuote();
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

function memberPoints(memberId) {
  const plans = state.memberPlans.filter((p) => Number(p.member_id) === Number(memberId));
  const checkins = state.checkins.filter((c) => Number(c.member_id) === Number(memberId));
  const awards = state.awards.filter((a) => Number(a.member_id) === Number(memberId));
  return plans.reduce((sum, p) => sum + Number(p.points || 0), 0)
    + checkins.reduce((sum, c) => sum + Number(c.points || 0), 0)
    + awards.reduce((sum, a) => sum + Number(a.points || 0), 0);
}

async function loadAll() {
  const [members, leaderPlans, memberPlans, checkins, awards] = await Promise.all([
    supabase.from("members").select("id,name,username,created_at").order("name"),
    supabase.from("leader_plans").select("*").order("created_at", { ascending: false }),
    supabase.from("member_plans").select("*").order("created_at", { ascending: true }),
    supabase.from("checkins").select("*").order("created_at", { ascending: false }),
    supabase.from("point_awards").select("*").order("created_at", { ascending: false }),
  ]);
  for (const result of [members, leaderPlans, memberPlans, checkins, awards]) {
    if (result.error) throw result.error;
  }
  state.members = members.data || [];
  state.leaderPlans = leaderPlans.data || [];
  state.memberPlans = memberPlans.data || [];
  state.checkins = checkins.data || [];
  state.awards = awards.data || [];
  render();
}

function renderEmployee() {
  if (currentEmployee) {
    $("currentEmployee").textContent = `${currentEmployee.name}（${currentEmployee.username || "员工"}）`;
    $("logoutBtn").classList.remove("hidden");
    $("employeeLoginBtn").textContent = "切换员工";
  } else {
    $("currentEmployee").textContent = "未登录";
    $("logoutBtn").classList.add("hidden");
    $("employeeLoginBtn").textContent = "员工登记/登录";
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
    $("myPlans").innerHTML = `<div class="item meta">请先点击“员工登记/登录”。</div>`;
    return;
  }
  if (!plans.length) {
    $("myPlans").innerHTML = `<div class="item meta">本周还没有计划。</div>`;
    return;
  }
  $("myPlans").innerHTML = plans
    .map(
      (plan, index) => `
      <article class="item todo-item ${plan.completed ? "done" : ""}">
        <div>
          <strong>${index + 1}. ${escapeHtml(plan.title)}</strong>
          <div class="meta">${plan.completed ? "已完成" : "未完成"} · +${Number(plan.points || 0)}</div>
        </div>
        <button class="${plan.completed ? "" : "primary"}" data-complete="${plan.id}">
          ${plan.completed ? "撤回" : "完成"}
        </button>
      </article>
    `
    )
    .join("");
}

function renderLeaderPlans() {
  const member = activeMember();
  if (!state.leaderPlans.length) {
    $("leaderPlans").innerHTML = `<div class="item meta">Leader 还没有发布计划。</div>`;
    return;
  }
  $("leaderPlans").innerHTML = state.leaderPlans
    .map((plan) => {
      const checked = member && state.checkins.find((c) => Number(c.member_id) === Number(member.id) && Number(c.leader_plan_id) === Number(plan.id));
      return `
        <article class="item ${checked ? "done" : ""}">
          <strong>${escapeHtml(plan.title)}</strong>
          <div class="meta">${escapeHtml(plan.week)}</div>
          <p>${escapeHtml(plan.details).replaceAll("\n", "<br>")}</p>
          ${
            checked
              ? `<div class="meta">已响应 · +${checked.points}</div>`
              : `<button class="primary" data-checkin="${plan.id}">响应打卡</button>`
          }
        </article>
      `;
    })
    .join("");
}

function renderLeader() {
  $("rewardMember").innerHTML = state.members
    .map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`)
    .join("");

  $("memberList").innerHTML = state.members
    .map(
      (m) => `
      <article class="item">
        <strong>${escapeHtml(m.name)}</strong>
        <div class="meta">账户：${escapeHtml(m.username || "未设置")} · 总积分：${memberPoints(m.id)}</div>
      </article>
    `
    )
    .join("") || `<div class="item meta">暂无员工。</div>`;

  $("progressBoard").innerHTML = state.members
    .map((member) => {
      const plans = state.memberPlans.filter((p) => Number(p.member_id) === Number(member.id) && p.week === currentWeek());
      const done = plans.filter((p) => p.completed).length;
      const pct = plans.length ? Math.round((done / plans.length) * 100) : 0;
      const checkins = state.checkins.filter((c) => Number(c.member_id) === Number(member.id));
      const awards = state.awards.filter((a) => Number(a.member_id) === Number(member.id));
      return `
        <article class="item">
          <strong>${escapeHtml(member.name)}</strong>
          <div class="meta">计划 ${done}/${plans.length} · ${pct}% · 打卡 ${checkins.length} 次 · 总积分 ${memberPoints(member.id)}</div>
          <div class="progress"><span style="width:${pct}%"></span></div>
          <div class="meta">最近奖励：${awards[0] ? `+${awards[0].points} ${escapeHtml(awards[0].reason)}` : "暂无"}</div>
          <div class="meta">本周计划：${plans.map((p) => `${p.completed ? "✓" : "□"} ${escapeHtml(p.title)}`).join("；") || "暂无"}</div>
        </article>
      `;
    })
    .join("") || `<div class="item meta">暂无进度。</div>`;
}

function render() {
  $("weekLabel").textContent = currentWeek();
  renderEmployee();
  renderMyPlans();
  renderLeaderPlans();
  renderLeader();
}

async function submitTodos() {
  const member = activeMember();
  if (!member) return toast("请先登记/登录员工账号。");
  const todos = parseTodos($("todoInput").value);
  if (!todos.length) return toast("请至少填写一条 Todo。");
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
    const { error } = await supabase.from("member_plans").update({
      completed: true,
      completed_at: new Date().toISOString(),
      points: 1,
    }).eq("id", plan.id);
    if (error) return toast(error.message);
    toast("完成计划，获得 1 分。");
  }
  await loadAll();
}

async function checkin(planId) {
  const member = activeMember();
  if (!member) return toast("请先登记/登录员工账号。");
  const note = prompt("写下你的响应/进度：");
  if (!note) return;
  const points = Math.floor(Math.random() * 6);
  const { error } = await supabase.from("checkins").insert({
    member_id: member.id,
    leader_plan_id: Number(planId),
    note,
    points,
  });
  if (error) return toast(error.message);
  await loadAll();
  toast(`响应成功，随机获得 ${points} 分。`);
}

async function publishPlan() {
  const title = $("leaderTitle").value.trim();
  const details = $("leaderDetails").value.trim();
  if (!title || !details) return toast("请填写标题和内容。");
  const { error } = await supabase.rpc("leader_create_plan", {
    p_code: leaderCode,
    p_week: currentWeek(),
    p_title: title,
    p_details: details,
  });
  if (error) return toast(error.message);
  $("leaderTitle").value = "";
  $("leaderDetails").value = "";
  await loadAll();
  toast("计划已发布。");
}

async function giveReward() {
  const memberId = Number($("rewardMember").value);
  const points = Number($("rewardPoints").value);
  const reason = $("rewardReason").value.trim() || "Leader 奖励";
  if (!memberId || !points) return toast("请选择员工并填写积分。");
  const { error } = await supabase.rpc("leader_award_points", {
    p_code: leaderCode,
    p_member_id: memberId,
    p_points: points,
    p_reason: reason,
  });
  if (error) return toast(error.message);
  $("rewardPoints").value = "";
  $("rewardReason").value = "";
  await loadAll();
  toast("奖励已发放。");
}

async function employeeRegister() {
  const name = $("employeeName").value.trim();
  const username = $("employeeUsername").value.trim();
  const password = $("employeePassword").value;
  const invite = $("inviteCode").value.trim();
  const { data, error } = await supabase.rpc("employee_register", {
    p_name: name,
    p_username: username,
    p_password: password,
    p_invite_code: invite,
  });
  if (error) return toast(error.message);
  currentEmployee = data[0];
  localStorage.setItem("tddCurrentEmployee", JSON.stringify(currentEmployee));
  $("employeeModal").classList.add("hidden");
  await loadAll();
  toast("登记成功，已保持登录。");
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

function setEmployeeMode(mode) {
  employeeMode = mode;
  $("loginModeBtn").classList.toggle("active", mode === "login");
  $("registerModeBtn").classList.toggle("active", mode === "register");
  $("employeeName").classList.toggle("hidden", mode === "login");
  $("inviteCode").classList.toggle("hidden", mode === "login");
  $("confirmEmployee").textContent = mode === "login" ? "登录" : "登记";
}

document.addEventListener("click", async (event) => {
  const completeId = event.target.dataset.complete;
  const checkinId = event.target.dataset.checkin;
  if (completeId) await completePlan(completeId);
  if (checkinId) await checkin(checkinId);
});

$("addPlanBtn").addEventListener("click", () => {
  editorMode = "add";
  $("todoInput").value = "1. ";
  $("submitTodos").textContent = "提交计划";
  $("planEditor").classList.remove("hidden");
});

$("editPlanBtn").addEventListener("click", () => {
  const member = activeMember();
  if (!member) return toast("请先登记/登录员工账号。");
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
$("publishPlan").addEventListener("click", publishPlan);
$("giveReward").addEventListener("click", giveReward);

$("employeeLoginBtn").addEventListener("click", () => {
  setEmployeeMode("login");
  $("employeeModal").classList.remove("hidden");
});
$("cancelEmployee").addEventListener("click", () => $("employeeModal").classList.add("hidden"));
$("loginModeBtn").addEventListener("click", () => setEmployeeMode("login"));
$("registerModeBtn").addEventListener("click", () => setEmployeeMode("register"));
$("confirmEmployee").addEventListener("click", () => {
  if (employeeMode === "login") employeeLogin();
  else employeeRegister();
});
$("logoutBtn").addEventListener("click", () => {
  currentEmployee = null;
  localStorage.removeItem("tddCurrentEmployee");
  render();
  toast("已退出员工账号。");
});

$("leaderLoginBtn").addEventListener("click", () => $("loginModal").classList.remove("hidden"));
$("cancelLogin").addEventListener("click", () => $("loginModal").classList.add("hidden"));
$("confirmLogin").addEventListener("click", async () => {
  const code = $("leaderCode").value;
  const { data, error } = await supabase.rpc("is_leader", { p_code: code });
  if (error || !data) return toast("leader 密码不正确。");
  leaderCode = code;
  sessionStorage.setItem("teamWeeklyLeaderCode", code);
  $("loginModal").classList.add("hidden");
  $("memberView").classList.remove("active");
  $("leaderView").classList.add("active");
  $("memberViewBtn").classList.remove("hidden");
});

$("memberViewBtn").addEventListener("click", () => {
  $("leaderView").classList.remove("active");
  $("memberView").classList.add("active");
  $("memberViewBtn").classList.add("hidden");
});

setEmployeeMode("login");
if (!config.SUPABASE_URL || config.SUPABASE_URL.includes("YOUR_PROJECT")) {
  toast("请先填写 config.js 里的 Supabase 配置。");
} else {
  loadAll().catch((error) => toast(error.message));
}
