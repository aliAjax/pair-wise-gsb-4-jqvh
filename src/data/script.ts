// 剧本资料：一句一条台词，带角色；数组顺序即演出顺序
export type Line = {
  id: number;
  character: string; // 角色
  text: string;      // 台词
  note?: string;     // 舞台提示
};

export const seedScript: Line[] = [
  { id: 1, character: '旁白', text: '雨下了一整夜。天亮了，老戏台的灯还亮着。', note: '灯光渐起，雨声渐弱' },
  { id: 2, character: '林澜', text: '这出戏我唱了十年，今天头一回站在台口发怵。' },
  { id: 3, character: '周叔', text: '怵什么？台下坐的都是看着你长大的人。' },
  { id: 4, character: '林澜', text: '就怕唱得太熟，他们听不出新的东西了。' },
  { id: 5, character: '小满', text: '姐，妈以前总说，戏是唱给明天听的。', note: '从侧幕探身' },
  { id: 6, character: '周叔', text: '开锣吧。弦子一响，心里就踏实了。' },
  { id: 7, character: '林澜', text: '好。这一嗓子，唱给明天。', note: '亮相，定音' },
  { id: 8, character: '旁白', text: '锣鼓点起，晨光正好落在戏台中央。', note: '灯光全亮，幕启' },
];
