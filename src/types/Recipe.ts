export interface Recipe {
  id: string;
  name: string;
  description: string;
  servings: string;
  prep_time: string;
  cook_time: string;
  total_time: string;
  difficulty: string;
  tags: string[];
  ingredients: string[];
  instructions: string[];
  notes?: string[];
  image_url: string;
}
