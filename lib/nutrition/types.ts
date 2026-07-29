export interface NutritionInput {
  photoUrl?: string;
  description?: string;
}

export interface NutritionEstimate {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionProvider {
  estimate(input: NutritionInput): Promise<NutritionEstimate>;
}
