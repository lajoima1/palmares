import { describe, expect, it } from "vitest";
import { clock, stepIngredients, stepTimes, timeLabel, timeLeft } from "./cook.ts";

const PUDDING = [
  "## Pour le gâteau:",
  "1 1/2 tasse de farine tamisée",
  "1 c. à thé de poudre à pâte",
  "1/4 tasse de beurre",
  "2/3 tasse de sucre",
  "1 œuf",
  "1 c. à thé d'extrait de vanille",
  "1/2 tasse de lait",
  "## Pour la sauce: ",
  "1 tasse de sirop d’érable",
  "1 tasse de cassonade",
  "1 tasse d’eau bouillante",
  "1/4 tasse de beurre",
];

describe("stepIngredients", () => {
  it("finds the ingredients of each step of Pouding chômeur", () => {
    expect(stepIngredients("Préchauffer le four à 325°F.", PUDDING)).toEqual([]);
    expect(stepIngredients("Mélanger la farine et la poudre à pâte dans un bol. Réserver.", PUDDING)).toEqual([
      "1 1/2 tasse de farine tamisée",
      "1 c. à thé de poudre à pâte",
    ]);
    expect(stepIngredients("Ajouter l’œuf et la vanille. Bien mélanger.", PUDDING)).toEqual([
      "1 œuf",
      "1 c. à thé d'extrait de vanille",
    ]);
    expect(stepIngredients("Verser la pâte dans le plat.", PUDDING)).toEqual([]);
  });

  it("shows two equal lines once", () => {
    expect(
      stepIngredients("Dans un petit chaudron, mélanger le sirop d’érable, la cassonade, l’eau bouillante et le beurre.", PUDDING),
    ).toEqual(["1/4 tasse de beurre", "1 tasse de sirop d’érable", "1 tasse de cassonade", "1 tasse d’eau bouillante"]);
  });

  it("does not take a word that only qualifies another ingredient", () => {
    const lines = ["1 boîte (10 oz total) crème de poulet condensée", "500 ml (2 tasses) poulet cuit en dés"];
    expect(stepIngredients("Étaler le mélange de poulet sur chaque tortilla.", lines)).toEqual([
      "500 ml (2 tasses) poulet cuit en dés",
    ]);
  });

  it("keeps the line with more words in the step if two lines share a main word", () => {
    const lines = ["1 can (≈425 g / 15 oz total) diced tomatoes", "1 can (≈227 g / 8 oz total) tomato sauce"];
    expect(stepIngredients("Combine the tomato sauce with the Worcestershire sauce.", lines)).toEqual([lines[1]]);
    expect(stepIngredients("Add the diced tomatoes with their juices.", lines)).toEqual([lines[0]]);
    const fr = ["1 boîte (≈793 g / 28 oz total) de tomates en dés (avec jus)", "1 boîte (≈425 g / 15 oz total) de sauce tomate"];
    expect(stepIngredients("Ajouter les tomates en dés et la sauce tomate.", fr)).toEqual(fr);
    expect(stepIngredients("Ajouter la sauce tomate.", fr)).toEqual([fr[1]]);
    const spices = ["1 c. à thé de poudre d’ail", "1 c. à thé de poudre d’oignon"];
    expect(stepIngredients("Mélanger la poudre d’ail et la poudre d’oignon.", spices)).toEqual(spices);
  });

  it("links garlic by its name, not by the clove", () => {
    expect(stepIngredients("Ajouter l’oignon et l’ail émincés.", ["1 oignon jaune, haché", "4 gousses d’ail, émincées"])).toEqual([
      "1 oignon jaune, haché",
      "4 gousses d’ail, émincées",
    ]);
  });

  it("skips the container, the cut and the adjectives before the name", () => {
    expect(stepIngredients("Rouler le poulet.", ["4 demi-poitrines de poulet désossées"])).toEqual(["4 demi-poitrines de poulet désossées"]);
    expect(stepIngredients("Add the basil and oregano.", ["1 tsp dried basil", "1 tsp dried oregano"])).toEqual([
      "1 tsp dried basil",
      "1 tsp dried oregano",
    ]);
    expect(stepIngredients("Ajouter le bouillon.", ["Concentré de bouillon de bœuf liquide"])).toEqual([
      "Concentré de bouillon de bœuf liquide",
    ]);
  });
});

describe("stepTimes", () => {
  it("reads minutes and hours, in French and in English", () => {
    expect(stepTimes("Cuire au four pendant 45 minutes.")).toEqual([45 * 60]);
    expect(stepTimes("Couvrir et faire cuire pendant 1 heure.")).toEqual([3600]);
    expect(stepTimes("Cook 1 hour, then serve.")).toEqual([3600]);
    expect(stepTimes("Cuire 15 à 20 min. à 350°F en bas.")).toEqual([15 * 60]);
  });

  it("takes the first number of a range", () => {
    expect(stepTimes("Laisser mijoter 5 à 7 minutes, jusqu’à ce que la sauce épaississe.")).toEqual([5 * 60]);
    expect(stepTimes("Cook 5-6 minutes, breaking it apart.")).toEqual([5 * 60]);
    expect(stepTimes("Bake 25 to 30 minutes, until golden.")).toEqual([25 * 60]);
    expect(stepTimes("Cuire au four pendant 2 heures à 2 heures 30 minutes.")).toEqual([2 * 3600]);
  });

  it("reads hours with minutes", () => {
    expect(stepTimes("Cuire 1 heure 15 minutes.")).toEqual([3600 + 15 * 60]);
    expect(stepTimes("Cuire 2 h 30 à feu doux.")).toEqual([2 * 3600 + 30 * 60]);
    expect(stepTimes("Cuire 1 h 1/2 lentement.")).toEqual([3600 + 30 * 60]);
    expect(stepTimes("Laisser reposer 8 heures 10 minutes.")).toEqual([8 * 3600 + 10 * 60]);
  });

  it("gives a button for each of two times", () => {
    expect(stepTimes("Cover and cook on low for 7-8 hours or on high for 4-5 hours.")).toEqual([7 * 3600, 4 * 3600]);
    expect(stepTimes("Couvrir et cuire sur **low pendant 8 heures** ou **high pendant 4 heures**.")).toEqual([8 * 3600, 4 * 3600]);
  });

  it("reads fractions of an hour, and never takes a temperature for minutes", () => {
    expect(stepTimes("Cuire 1/2 heure.")).toEqual([1800]);
    expect(stepTimes("Cuire 1 heure et demie.")).toEqual([5400]);
    expect(stepTimes("Cuire 1 1/2 minute.")).toEqual([90]);
    expect(stepTimes("Cuire 1 heure 350 °F.")).toEqual([3600]);
    expect(stepTimes("Cuire 1 h 350 °F.")).toEqual([3600]);
    expect(stepTimes("Cuire 1 heure 30.")).toEqual([5400]);
    expect(stepTimes("Cuire 1 heure 1/2.")).toEqual([5400]);
    expect(stepTimes("Cuire 2 heures et 1/2.")).toEqual([9000]);
    expect(stepTimes("Bake 1 hr 15 at 350.")).toEqual([4500]);
  });

  it("does not take how often for how long", () => {
    expect(stepTimes("Cuire pendant environ 2 heures en remuant toutes les 5 à 10 minutes.")).toEqual([2 * 3600]);
    expect(stepTimes("Stir every 5 minutes for 1 hour.")).toEqual([3600]);
  });

  it("gives no time for seconds or words", () => {
    expect(stepTimes("Cuire environ 30 secondes.")).toEqual([]);
    expect(stepTimes("Laisser mijoter quelques minutes.")).toEqual([]);
    expect(stepTimes("Préchauffer le four à 190 °C (375 °F).")).toEqual([]);
  });
});

describe("the timer text", () => {
  it("counts the seconds left from the end time", () => {
    expect(timeLeft(10_000, 0)).toBe(10);
    expect(timeLeft(10_000, 9_001)).toBe(1);
    expect(timeLeft(10_000, 12_000)).toBe(0);
  });

  it("writes a clock and a label", () => {
    expect(clock(299)).toBe("4:59");
    expect(clock(3725)).toBe("1:02:05");
    expect(timeLabel(45 * 60)).toBe("45 min");
    expect(timeLabel(90 * 60)).toBe("1 h 30");
    expect(timeLabel(8 * 3600)).toBe("8 h");
  });
});
