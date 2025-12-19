import dotenv from "dotenv";
import fetch from "node-fetch";
import schedule from "node-schedule";
import { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } from "discord.js";

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
      console.log(`Role assigned automatically: ${member.user.tag}`);
    }
  } catch (err) {
    console.log("Error assigning role:", err);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!alert") {
    const channel = await client.channels.fetch(TIMETABLE_CHANNEL);
    if (!channel) return console.log("⚠ Target channel not found");

    await sendTimetableAndLunch(channel);
  }
});

// 슬래시 명령어 처리
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    if (commandName === "오늘의급식") {
      const date = new Date();
      date.setHours(date.getHours() + 9);
      const dayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
      const lunch = await getLunchForDate(0);
      const embed = new EmbedBuilder()
        .setColor("#4a90e2")
        .setTitle("🍱 오늘의 급식")
        .setDescription(lunch || "급식 정보 없음")
        .setTimestamp()
        .setFooter({ text: `급식 알리미 | ${date.getMonth()+1}월 ${date.getDate()}일 ${dayNames[date.getDay()]}` });
      await interaction.reply({ embeds: [embed] });
    } else if (commandName === "내일의급식") {
      const date = new Date();
      date.setHours(date.getHours() + 9);
      date.setDate(date.getDate() + 1);
      const dayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
      const lunch = await getLunchForDate(1);
      const embed = new EmbedBuilder()
        .setColor("#4a90e2")
        .setTitle("🍱 내일의 급식")
        .setDescription(lunch || "급식 정보 없음")
        .setTimestamp()
        .setFooter({ text: `급식 알리미 | ${date.getMonth()+1}월 ${date.getDate()}일 ${dayNames[date.getDay()]}` });
      await interaction.reply({ embeds: [embed] });
    } else if (commandName === "어제의급식") {
      const date = new Date();
      date.setHours(date.getHours() + 9);
      date.setDate(date.getDate() - 1);
      const dayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
      const lunch = await getLunchForDate(-1);
      const embed = new EmbedBuilder()
        .setColor("#4a90e2")
        .setTitle("🍱 어제의 급식")
        .setDescription(lunch || "급식 정보 없음")
        .setTimestamp()
        .setFooter({ text: `급식 알리미 | ${date.getMonth()+1}월 ${date.getDate()}일 ${dayNames[date.getDay()]}` });
      await interaction.reply({ embeds: [embed] });
    } else if (commandName === "오늘의시간표") {
      const date = new Date();
      date.setHours(date.getHours() + 9);
      const dayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
      const timetable = await getTimetableForDate(0);
      const embed = new EmbedBuilder()
        .setColor("#4a90e2")
        .setTitle("⏰ 오늘의 시간표")
        .setDescription(timetable || "시간표 정보 없음")
        .setTimestamp()
        .setFooter({ text: `시간표 알리미 | ${date.getMonth()+1}월 ${date.getDate()}일 ${dayNames[date.getDay()]}` });
      await interaction.reply({ embeds: [embed] });
    } else if (commandName === "내일의시간표") {
      const date = new Date();
      date.setHours(date.getHours() + 9);
      date.setDate(date.getDate() + 1);
      const dayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
      const timetable = await getTimetableForDate(1);
      const embed = new EmbedBuilder()
        .setColor("#4a90e2")
        .setTitle("⏰ 내일의 시간표")
        .setDescription(timetable || "시간표 정보 없음")
        .setTimestamp()
        .setFooter({ text: `시간표 알리미 | ${date.getMonth()+1}월 ${date.getDate()}일 ${dayNames[date.getDay()]}` });
      await interaction.reply({ embeds: [embed] });
    } else if (commandName === "어제의시간표") {
      const date = new Date();
      date.setHours(date.getHours() + 9);
      date.setDate(date.getDate() - 1);
      const dayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
      const timetable = await getTimetableForDate(-1);
      const embed = new EmbedBuilder()
        .setColor("#4a90e2")
        .setTitle("⏰ 어제의 시간표")
        .setDescription(timetable || "시간표 정보 없음")
        .setTimestamp()
        .setFooter({ text: `시간표 알리미 | ${date.getMonth()+1}월 ${date.getDate()}일 ${dayNames[date.getDay()]}` });
      await interaction.reply({ embeds: [embed] });
    }
  } catch (error) {
    console.error("Error handling interaction:", error);
    await interaction.reply({ content: "오류가 발생했습니다.", ephemeral: true });
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

async function getTimetableForDate(dayOffset = 0) {
  const date = new Date();
  date.setHours(date.getHours() + 9);
  date.setDate(date.getDate() + dayOffset);
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
      return "시간표 정보가 없습니다 (쉬는날)";

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
          return `${p.PERIO}교시: 선택 ${seletetimeMap[key]}`;
        }
        return `${p.PERIO}교시: ${p.ITRT_CNTNT}`;
      })
      .filter(Boolean)
      .join("\n");
  } catch {
    return "시간표 정보가 없습니다 (쉬는날)";
  }
}

async function getTimetable() {
  return await getTimetableForDate(0);
}

async function getLunchForDate(dayOffset = 0) {
  const date = new Date();
  date.setHours(date.getHours() + 9);
  date.setDate(date.getDate() + dayOffset);
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
      return "급식 정보가 없습니다 (쉬는날)";

    let lunch = json.mealServiceDietInfo[1].row[0].DDISH_NM.replace(
      /<br\/>/g,
      "\n"
    );
    lunch = lunch.replace(/[~!@#$%^*_\-+=`{}\[\]|\\:;"'<>,.?\/]/g, "");
    lunch = lunch.replace(/\(\d+\)/g, "");

    return lunch || "급식 정보가 없습니다 (쉬는날)";
  } catch {
    return "급식 정보가 없습니다 (쉬는날)";
  }
}

async function getLunch() {
  return await getLunchForDate(0);
}

schedule.scheduleJob("0 23 * * 0-4", async () => {
  const channel = await client.channels.fetch(TIMETABLE_CHANNEL);
  if (!channel) return console.log("⚠ Target channel not found");

  await sendTimetableAndLunch(channel);
});

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity("승현이 맛있겠다", { type: 0 });

  // 슬래시 명령어 등록
  const commands = [
    {
      name: "오늘의급식",
      description: "오늘의 급식을 확인합니다",
    },
    {
      name: "내일의급식",
      description: "내일의 급식을 확인합니다",
    },
    {
      name: "어제의급식",
      description: "어제의 급식을 확인합니다",
    },
    {
      name: "오늘의시간표",
      description: "오늘의 시간표를 확인합니다",
    },
    {
      name: "내일의시간표",
      description: "내일의 시간표를 확인합니다",
    },
    {
      name: "어제의시간표",
      description: "어제의 시간표를 확인합니다",
    },
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    console.log("슬래시 명령어를 등록하는 중...");
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: commands,
    });
    console.log("슬래시 명령어 등록 완료!");
  } catch (error) {
    console.error("슬래시 명령어 등록 중 오류:", error);
  }
});

client.login(process.env.TOKEN);
