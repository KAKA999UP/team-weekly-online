import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.TEAM_WIDGET_CONFIG || {};
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

let state = {
  members: [],
  leaderPlans: [],
  memberPlans: [],
  checkins: [],
};
let activeMemberId = localStorage.getItem("teamWeeklyMemberId") || "";
let leaderCode = sessionStorage.getItem("teamWeeklyLeaderCode") || "";
let editorMode = "add";

const $ = (id) => document.getElementById(id);

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
  toast.timer = setTimeout(() => $("toast").classList.remove("show"), 2400);
}

function parseTodos(raw) {
  return raw
    .split(/\n+/)
    .map((line) => line.trim().replace(/^\d+\.\s*/, ""))
    .filter(Boolean);
}

function activeMember() {
  return state.members.find((m) => String(m.id) === String(activeMemberId));
}

async function loadAll() {
  const [members, leaderPlans, memberPlans, checkins] = await Promise.all([
    supabase.from("members").select("*").order("name"),
    supabase.from("leader_plans").select("*").order("created_at", { ascending: false }),
    supabase.from("member_plans").select("*").order("created_at", { ascending: true }),
    supabase.from("checkins").select("*").order("created_at", { ascending: false }),
  ]);
  for (const result of [members, leaderPlans, memberPlans, checkins]) {
    if (result.error) throw result.error;
  }
  state.members = members.data || [];
  state.leaderPlans = leaderPlans.data || [];
  state.memberPlans = memberPlans.data || [];
  state.checkins = checkins.data || [];
  if (!activeMemberId && state.members[0]) activeMemberId = String(state.members[0].id);
  render();
}

function renderMemberSelect() {
  $("memberSelect").innerHTML = [
    `<option value="">请选择成员</option>`,
    ...state.members.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`),
  ].join("");
  $("memberSelect").value = activeMemberId;
}

function renderMyPlans() {
  const member = activeMember();
  const week = currentWeek();
  const plans = member ? state.memberPlans.filter((p) => p.member_id === member.id && p.week === week) : [];
  const done = plans.filter((p) => p.completed).length;
  const pct = plans.length ? Math.round((done / plans.length) * 100) : 0;
  $("completionText").textContent = `${pct}% (${done}/${plans.length})`;
  $("completionBar").style.width = `${pct}%`;

  const planPoints = plans.reduce((sum, p) => sum + Number(p.points || 0), 0);
  const checkinPoints = member
    ? state.checkins.filter((c) => c.member_id === member.id).reduce((sum, c) => sum + Number(c.points || 0), 0)
    : 0;
  $("myPoints").textContent = planPoints + checkinPoints;

  if (!member) {
    $("myPlans").innerHTML = `<div class="item meta">请先让 leader 添加成员。</div>`;
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
      const checked = member && state.checkins.find((c) => c.member_id === member.id && c.leader_plan_id === plan.id);
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
  $("memberList").innerHTML = state.members
    .map(
      (m) => `
      <article class="item todo-item">
        <strong>${escapeHtml(m.name)}</strong>
        <button class="danger" data-delete-member="${m.id}">删除</button>
      </article>
    `
    )
    .join("") || `<div class="item meta">暂无成员。</div>`;

  $("progressBoard").innerHTML = state.members
    .map((member) => {
      const plans = state.memberPlans.filter((p) => p.member_id === member.id && p.week === currentWeek());
      const done = plans.filter((p) => p.completed).length;
      const pct = plans.length ? Math.round((done / plans.length) * 100) : 0;
      const points = plans.reduce((sum, p) => sum + Number(p.points || 0), 0)
        + state.checkins.filter((c) => c.member_id === member.id).reduce((sum, c) => sum + Number(c.points || 0), 0);
      return `
        <article class="item">
          <strong>${escapeHtml(member.name)}</strong>
          <div class="meta">完成 ${done}/${plans.length} · ${pct}% · +${points}</div>
          <div class="progress"><span style="width:${pct}%"></span></div>
        </article>
      `;
    })
    .join("") || `<div class="item meta">暂无进度。</div>`;
}

function render() {
  $("weekLabel").textContent = currentWeek();
  renderMemberSelect();
  renderMyPlans();
  renderLeaderPlans();
  renderLeader();
}

async function submitTodos() {
  const member = activeMember();
  if (!member) return toast("请先选择成员。");
  const todos = parseTodos($("todoInput").value);
  if (!todos.length) return toast("请至少填写一条 Todo。");
  const oldPlans = state.memberPlans.filter((p) => p.member_id === member.id && p.week === currentWeek());
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
  await loadAll();
  toast("计划已保存。");
}

async function completePlan(id) {
  const plan = state.memberPlans.find((p) => p.id === Number(id));
  if (!plan) return;
  if (plan.completed) {
    const { error } = await supabase.from("member_plans").update({ completed: false, completed_at: null, points: 0 }).eq("id", plan.id);
    if (error) return toast(error.message);
  } else {
    const points = Math.floor(Math.random() * 11);
    const { error } = await supabase.from("member_plans").update({
      completed: true,
      completed_at: new Date().toISOString(),
      points,
    }).eq("id", plan.id);
    if (error) return toast(error.message);
    toast(`完成，随机获得 ${points} 积分。`);
  }
  await loadAll();
}

async function checkin(planId) {
  const member = activeMember();
  if (!member) return toast("请先选择成员。");
  const note = prompt("写下你的响应/进度：");
  if (!note) return;
  const points = Math.floor(Math.random() * 11);
  const { error } = await supabase.from("checkins").insert({
    member_id: member.id,
    leader_plan_id: Number(planId),
    note,
    points,
  });
  if (error) return toast(error.message);
  await loadAll();
  toast(`响应成功，随机获得 ${points} 积分。`);
}

async function addMember() {
  const name = $("newMemberName").value.trim();
  if (!name) return toast("请输入成员姓名。");
  const { error } = await supabase.rpc("leader_add_member", { p_code: leaderCode, p_name: name });
  if (error) return toast(error.message);
  $("newMemberName").value = "";
  await loadAll();
  toast("成员已添加。");
}

async function deleteMember(id) {
  if (!confirm("确定删除这个成员吗？相关计划和打卡也会删除。")) return;
  const { error } = await supabase.rpc("leader_delete_member", { p_code: leaderCode, p_member_id: Number(id) });
  if (error) return toast(error.message);
  await loadAll();
  toast("成员已删除。");
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

document.addEventListener("click", async (event) => {
  const completeId = event.target.dataset.complete;
  const checkinId = event.target.dataset.checkin;
  const deleteId = event.target.dataset.deleteMember;
  if (completeId) await completePlan(completeId);
  if (checkinId) await checkin(checkinId);
  if (deleteId) await deleteMember(deleteId);
});

$("memberSelect").addEventListener("change", async () => {
  activeMemberId = $("memberSelect").value;
  localStorage.setItem("teamWeeklyMemberId", activeMemberId);
  render();
});

$("addPlanBtn").addEventListener("click", () => {
  editorMode = "add";
  $("todoInput").value = "1. ";
  $("submitTodos").textContent = "提交计划";
  $("planEditor").classList.remove("hidden");
});

$("editPlanBtn").addEventListener("click", () => {
  const member = activeMember();
  if (!member) return toast("请先选择成员。");
  const plans = state.memberPlans.filter((p) => p.member_id === member.id && p.week === currentWeek());
  $("todoInput").value = plans.length
    ? plans.map((p, index) => `${index + 1}. ${p.title}`).join("\n")
    : "1. ";
  editorMode = "edit";
  $("submitTodos").textContent = "保存修改";
  $("planEditor").classList.remove("hidden");
});

$("showPlanBtn").addEventListener("click", () => $("planEditor").classList.add("hidden"));
$("submitTodos").addEventListener("click", submitTodos);
$("addMember").addEventListener("click", addMember);
$("publishPlan").addEventListener("click", publishPlan);

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

if (!config.SUPABASE_URL || config.SUPABASE_URL.includes("YOUR_PROJECT")) {
  toast("请先填写 config.js 里的 Supabase 配置。");
} else {
  loadAll().catch((error) => toast(error.message));
}
