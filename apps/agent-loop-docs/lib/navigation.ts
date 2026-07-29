export type ConceptNavItem = {
  href: string;
  shortLabel: string;
  label: string;
  description: string;
  track: "decision" | "synthesis";
};

export const conceptNav: ConceptNavItem[] = [
  {
    href: "/mdp",
    shortLabel: "MDP",
    label: "Markov Decision Process",
    description: "작업 상태와 장기 결과로 다음 행동을 비교",
    track: "decision",
  },
  {
    href: "/pomdp",
    shortLabel: "POMDP",
    label: "Partially Observable MDP",
    description: "테스트 결과로 결함 원인 가설을 갱신",
    track: "decision",
  },
  {
    href: "/ogis",
    shortLabel: "OGIS",
    label: "Oracle-Guided Synthesis",
    description: "질의 형식과 응답으로 patch 후보를 축소",
    track: "synthesis",
  },
  {
    href: "/cegis",
    shortLabel: "CEGIS",
    label: "Counterexample-Guided Synthesis",
    description: "실패 입력을 다음 patch의 제약으로 보존",
    track: "synthesis",
  },
];
