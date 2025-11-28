import dotenv from "dotenv";
import fetch from "node-fetch";
import schedule from "node-schedule";
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const ROLE_TO_GIVE = process.env.ROLE_TO_GIVE;
const TIMETABLE_CHANNEL = process.env.TIMETABLE_CHANNEL;

client.on("guildMemberAdd", async (member) => {
  try {
    const role = member.guild.roles.cache.get(ROLE_TO_GIVE);
    if (role) {
      await member.roles.add(role);
      console.log(`> Role assigned automatically: ${member.user.tag}`);
    }
  } catch (err) {
    console.log("Error assigning role:", err);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!test") {
    const channel = await client.channels.fetch(TIMETABLE_CHANNEL);
    if (!channel) return console.log("⚠ Target channel not found");

    await sendTimetableAndLunch(channel);
  }
});

async function sendTimetableAndLunch(channel) {
  const timetable = await getTimetable();
  const lunch = await getLunch();

  const embed = new EmbedBuilder()
    .setColor("#4a90e2")
    .setTitle("📅 오늘의 시간표 & 급식")
    .addFields(
      { name: "⏰ 시간표", value: timetable || "시간표 정보 없음" },
      { name: "🍱 급식", value: lunch || "급식 정보 없음" }
    )
    .setTimestamp()
    .setFooter({ text: "시간표/급식 알리미" });

  channel.send({ embeds: [embed] });
  console.log("Timetable and lunch sent successfully");
}

async function getTimetable() {
  const date = new Date();
  date.setHours(date.getHours() + 9);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const url =
    `https://open.neis.go.kr/hub/hisTimetable?KEY=${process.env.NEIS_KEY}` +
    `&Type=json&pIndex=1&pSize=100` +
    `&ATPT_OFCDC_SC_CODE=${process.env.ATPT}` +
    `&SD_SCHUL_CODE=${process.env.SCHOOL}` +
    `&ALL_TI_YMD=${year}${month}${day}` +
    `&GRADE=${process.env.GRADE}&CLASS_NM=${process.env.CLASS}`;

  let seletetimeMap = {};
  if (process.env.SELETETIME) {
    process.env.SELETETIME.split(",").forEach((item) => {
      const letter = item[0].toUpperCase();
      const weekday = item[1];
      const period = item[2];
      seletetimeMap[`${weekday}${period}`] = letter;
    });
  }

  try {
    const res = await fetch(url);
    const json = await res.json();

    if (!json.hisTimetable || !json.hisTimetable[1])
      return "No timetable available";

    return json.hisTimetable[1].row
      .map((p) => {
        const dateObj = new Date(
          p.ALL_TI_YMD.slice(0, 4) +
            "-" +
            p.ALL_TI_YMD.slice(4, 6) +
            "-" +
            p.ALL_TI_YMD.slice(6, 8)
        );
        let weekday = dateObj.getDay();
        if (weekday === 0 || weekday === 6) return null;
        const key = `${weekday}${p.PERIO}`;
        if (seletetimeMap[key]) {
          return `${p.PERIO}교시: 선택${seletetimeMap[key]}`;
        }
        return `${p.PERIO}교시: ${p.ITRT_CNTNT}`;
      })
      .filter(Boolean)
      .join("\n");
  } catch {
    return "No timetable available";
  }
}

async function getLunch() {
  const date = new Date();
  date.setHours(date.getHours() + 9);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const url =
    `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${process.env.NEIS_KEY}` +
    `&Type=json&pIndex=1&pSize=100` +
    `&ATPT_OFCDC_SC_CODE=${process.env.ATPT}` +
    `&SD_SCHUL_CODE=${process.env.SCHOOL}` +
    `&MLSV_YMD=${year}${month}${day}`;

  try {
    const res = await fetch(url);
    const json = await res.json();

    if (!json.mealServiceDietInfo || !json.mealServiceDietInfo[1])
      return "No lunch available";

    let lunch = json.mealServiceDietInfo[1].row[0].DDISH_NM.replace(
      /<br\/>/g,
      "\n"
    );
    lunch = lunch.replace(/[~!@#$%^*_\-+=`{}\[\]|\\:;"'<>,.?\/]/g, "");
    lunch = lunch.replace(/\(\d+\)/g, "");

    return lunch || "No lunch available";
  } catch {
    return "No lunch available";
  }
}

schedule.scheduleJob("30 23 * * 0-4", async () => {
  const channel = await client.channels.fetch(TIMETABLE_CHANNEL);
  if (!channel) return console.log("⚠ Target channel not found");

  await sendTimetableAndLunch(channel);
});

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity("인라요 노예 10호", { type: 0 });
});

client.login(process.env.TOKEN);
