import type { ReadingPackData } from "./readingPackTypes";

export const DEMO_READING_PACK: ReadingPackData = {
  schemaVersion: 2,
  cefrLevel: "B1",
  textType: "article",
  title: "Working from home: finding a good balance",
  reading: {
    standard: `Working from home has become a normal part of life for many people. It can save commuting time and give workers more flexibility, but it also creates new challenges. When home and work happen in the same place, it can be difficult to know when the working day has finished.\n\nA simple routine can make a big difference. Many remote workers start at the same time each morning, take a proper lunch break and choose a clear finishing time. Some people also create a small work area so that they can leave their laptop there at the end of the day.\n\nCommunication is important too. In an office, it is easy to ask a quick question or notice when a colleague needs help. At home, workers often need to be more deliberate. Short messages, regular meetings and clear deadlines can help a team stay connected without spending the whole day online.\n\nThere is no single routine that works for everyone. The most useful approach is to notice what helps you concentrate, what causes stress and what allows you to switch off after work. A good balance usually comes from a few simple habits rather than one perfect solution.`,
    supported: `Many people now work from home. Working from home can save travel time and give people more flexibility. However, it can also be difficult to separate work time from personal time.\n\nA clear routine can help. A worker can start at the same time each morning, take a real lunch break and choose a finishing time. It can also help to use one small area of the home for work. At the end of the day, the worker can leave the laptop there and stop working.\n\nCommunication is also important. In an office, people can ask questions quickly. At home, workers need to communicate more clearly. Short messages, regular meetings and clear deadlines can help a team stay connected.\n\nDifferent routines work for different people. The important thing is to notice which habits help you concentrate, reduce stress and switch off after work. A few simple habits can create a better balance.`,
  },
  exercises: [
    {
      id: "1",
      type: "gist",
      skill: "main idea",
      answer: "Simple routines and clear communication can help people create a healthy balance when working from home.",
      standard: { prompt: "What is the main message of the article?" },
      supported: { prompt: "What is the article mainly about?" },
    },
    {
      id: "2",
      type: "multiple_choice",
      skill: "detail",
      answer: "B",
      answerIndex: 1,
      standard: {
        prompt: "According to the article, why can a separate work area be useful?",
        options: ["A. It makes meetings shorter.", "B. It helps create a boundary between work and free time.", "C. It removes the need for a routine."],
      },
      supported: {
        prompt: "Why can it help to work in one area of the home?",
        options: ["A. Meetings are shorter.", "B. It helps you separate work time and free time.", "C. You do not need a routine."],
      },
    },
    {
      id: "3",
      type: "true_false",
      skill: "detail",
      answer: "False",
      standard: { prompt: "True or false: Remote workers should stay online all day to communicate well." },
      supported: { prompt: "True or false: Good communication means being online all day." },
    },
    {
      id: "4",
      type: "vocabulary",
      skill: "meaning in context",
      answer: "deliberate = planned or done intentionally",
      standard: { prompt: "In paragraph 3, what does 'deliberate' mean in the phrase 'be more deliberate'?" },
      supported: { prompt: "What does 'deliberate' mean here: planned, accidental, or noisy?", options: ["planned", "accidental", "noisy"] },
    },
    {
      id: "5",
      type: "inference",
      skill: "inference",
      answer: "The writer believes people should find routines that suit their own needs rather than copy one fixed system.",
      standard: { prompt: "What can you infer about the writer's view of the 'perfect' remote-work routine?" },
      supported: { prompt: "Does the writer think one routine is perfect for everyone? Explain briefly." },
    },
    {
      id: "6",
      type: "personal_response",
      skill: "speaking",
      answer: "Answers will vary.",
      standard: { prompt: "Which habit from the article would be most useful for you, and why?" },
      supported: { prompt: "Choose one useful habit from the article. Why would it help you?" },
    },
  ],
  teacherContext: {
    contextTags: ["workplace English", "remote work", "wellbeing"],
    crossCurricularLinks: [],
    authenticMaterialTypes: ["article"],
    localVocab: "routine, flexibility, deadline, concentrate, switch off",
    localGlossary: [
      { term: "flexibility", note: "the ability to change or adapt easily" },
      { term: "deadline", note: "the time by which work must be finished" },
      { term: "switch off", note: "to stop thinking about work and relax" },
    ],
    useLocalContextExactly: true,
    onlyUseProvidedFacts: true,
  },
  pilotMode: true,
};
