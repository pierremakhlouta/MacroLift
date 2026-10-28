
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "body_measurements": {
                  Row: {
                    "created_at": string,"id": string,"measured_on": string,"site": Database["public"]['Enums']["measurement_site"],"updated_at": string,"user_id": string,"value_cm": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"measured_on": string,"site": Database["public"]['Enums']["measurement_site"],"updated_at"?: string,"user_id"?: string,"value_cm": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"measured_on"?: string,"site"?: Database["public"]['Enums']["measurement_site"],"updated_at"?: string,"user_id"?: string,"value_cm"?: number
                  }
                  Relationships: [
                    
                  ]
                },"diary_entries": {
                  Row: {
                    "brand": string | null,"calories_kcal": number | null,"carbs_g": number | null,"created_at": string,"fat_g": number | null,"fiber_g": number | null,"food_id": string | null,"food_name": string,"id": string,"meal": Database["public"]['Enums']["meal_category"],"meal_template_id": string | null,"nutrition_day_id": string,"position": number,"protein_g": number | null,"quantity": number,"serving_size": number,"serving_unit": string,"sodium_mg": number | null,"sugar_g": number | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand"?: string | null,"calories_kcal"?: number | null,"carbs_g"?: number | null,"created_at"?: string,"fat_g"?: number | null,"fiber_g"?: number | null,"food_id"?: string | null,"food_name": string,"id": string,"meal": Database["public"]['Enums']["meal_category"],"meal_template_id"?: string | null,"nutrition_day_id": string,"position"?: number,"protein_g"?: number | null,"quantity": number,"serving_size": number,"serving_unit": string,"sodium_mg"?: number | null,"sugar_g"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "brand"?: string | null,"calories_kcal"?: number | null,"carbs_g"?: number | null,"created_at"?: string,"fat_g"?: number | null,"fiber_g"?: number | null,"food_id"?: string | null,"food_name"?: string,"id"?: string,"meal"?: Database["public"]['Enums']["meal_category"],"meal_template_id"?: string | null,"nutrition_day_id"?: string,"position"?: number,"protein_g"?: number | null,"quantity"?: number,"serving_size"?: number,"serving_unit"?: string,"sodium_mg"?: number | null,"sugar_g"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "diary_entries_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "diary_entries_meal_template_id_fkey"
      columns: ["meal_template_id"]
isOneToOne: false
      referencedRelation: "meal_templates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "diary_entries_nutrition_day_id_user_id_fkey"
      columns: ["nutrition_day_id","user_id"]
isOneToOne: false
      referencedRelation: "nutrition_days"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"exercises": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"equipment": Database["public"]['Enums']["equipment_type"] | null,"id": string,"load_type": Database["public"]['Enums']["load_type"],"muscles": (Database["public"]['Enums']["muscle_group"])[],"name": string,"owner_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"equipment"?: Database["public"]['Enums']["equipment_type"] | null,"id"?: string,"load_type"?: Database["public"]['Enums']["load_type"],"muscles"?: (Database["public"]['Enums']["muscle_group"])[],"name": string,"owner_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"equipment"?: Database["public"]['Enums']["equipment_type"] | null,"id"?: string,"load_type"?: Database["public"]['Enums']["load_type"],"muscles"?: (Database["public"]['Enums']["muscle_group"])[],"name"?: string,"owner_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"foods": {
                  Row: {
                    "archived_at": string | null,"brand": string | null,"calories_kcal": number | null,"carbs_g": number | null,"created_at": string,"fat_g": number | null,"fiber_g": number | null,"id": string,"name": string,"owner_id": string | null,"protein_g": number | null,"serving_size": number,"serving_unit": string,"sodium_mg": number | null,"sugar_g": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"brand"?: string | null,"calories_kcal"?: number | null,"carbs_g"?: number | null,"created_at"?: string,"fat_g"?: number | null,"fiber_g"?: number | null,"id"?: string,"name": string,"owner_id"?: string | null,"protein_g"?: number | null,"serving_size": number,"serving_unit": string,"sodium_mg"?: number | null,"sugar_g"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"brand"?: string | null,"calories_kcal"?: number | null,"carbs_g"?: number | null,"created_at"?: string,"fat_g"?: number | null,"fiber_g"?: number | null,"id"?: string,"name"?: string,"owner_id"?: string | null,"protein_g"?: number | null,"serving_size"?: number,"serving_unit"?: string,"sodium_mg"?: number | null,"sugar_g"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"meal_template_items": {
                  Row: {
                    "created_at": string,"food_id": string,"id": string,"position": number,"quantity": number,"template_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"food_id": string,"id"?: string,"position": number,"quantity": number,"template_id": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"food_id"?: string,"id"?: string,"position"?: number,"quantity"?: number,"template_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_template_items_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_template_items_template_id_user_id_fkey"
      columns: ["template_id","user_id"]
isOneToOne: false
      referencedRelation: "meal_templates"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"meal_templates": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"name": string,"notes": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name": string,"notes"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"notes"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"nutrition_days": {
                  Row: {
                    "created_at": string,"day": string,"id": string,"notes": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day": string,"id"?: string,"notes"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"day"?: string,"id"?: string,"notes"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"nutrition_targets": {
                  Row: {
                    "calories_kcal": number | null,"carbs_g": number | null,"created_at": string,"effective_from": string,"fat_g": number | null,"fiber_g": number | null,"id": string,"protein_g": number | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "calories_kcal"?: number | null,"carbs_g"?: number | null,"created_at"?: string,"effective_from": string,"fat_g"?: number | null,"fiber_g"?: number | null,"id"?: string,"protein_g"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "calories_kcal"?: number | null,"carbs_g"?: number | null,"created_at"?: string,"effective_from"?: string,"fat_g"?: number | null,"fiber_g"?: number | null,"id"?: string,"protein_g"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "activity_level": Database["public"]['Enums']["activity_level"] | null,"birth_date": string | null,"created_at": string,"display_name": string | null,"estimate_sex": Database["public"]['Enums']["estimate_sex"] | null,"height_cm": number | null,"id": string,"onboarding_completed_at": string | null,"unit_system": Database["public"]['Enums']["unit_system"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_level"?: Database["public"]['Enums']["activity_level"] | null,"birth_date"?: string | null,"created_at"?: string,"display_name"?: string | null,"estimate_sex"?: Database["public"]['Enums']["estimate_sex"] | null,"height_cm"?: number | null,"id": string,"onboarding_completed_at"?: string | null,"unit_system"?: Database["public"]['Enums']["unit_system"],"updated_at"?: string
                  }
                  Update: {
                    "activity_level"?: Database["public"]['Enums']["activity_level"] | null,"birth_date"?: string | null,"created_at"?: string,"display_name"?: string | null,"estimate_sex"?: Database["public"]['Enums']["estimate_sex"] | null,"height_cm"?: number | null,"id"?: string,"onboarding_completed_at"?: string | null,"unit_system"?: Database["public"]['Enums']["unit_system"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"routine_exercises": {
                  Row: {
                    "created_at": string,"exercise_id": string,"id": string,"notes": string | null,"position": number,"routine_id": string,"target_reps_max": number | null,"target_reps_min": number | null,"target_sets": number | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"exercise_id": string,"id"?: string,"notes"?: string | null,"position": number,"routine_id": string,"target_reps_max"?: number | null,"target_reps_min"?: number | null,"target_sets"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"exercise_id"?: string,"id"?: string,"notes"?: string | null,"position"?: number,"routine_id"?: string,"target_reps_max"?: number | null,"target_reps_min"?: number | null,"target_sets"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "routine_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "routine_exercises_routine_id_user_id_fkey"
      columns: ["routine_id","user_id"]
isOneToOne: false
      referencedRelation: "routines"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"routines": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"name": string,"notes": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name": string,"notes"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"notes"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"session_exercises": {
                  Row: {
                    "created_at": string,"exercise_id": string | null,"exercise_name_snapshot": string,"id": string,"load_type_snapshot": Database["public"]['Enums']["load_type"],"notes": string | null,"position": number,"revision": number,"session_id": string,"target_reps_max": number | null,"target_reps_min": number | null,"target_sets": number | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"exercise_id"?: string | null,"exercise_name_snapshot": string,"id": string,"load_type_snapshot"?: Database["public"]['Enums']["load_type"],"notes"?: string | null,"position": number,"revision"?: number,"session_id": string,"target_reps_max"?: number | null,"target_reps_min"?: number | null,"target_sets"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"exercise_id"?: string | null,"exercise_name_snapshot"?: string,"id"?: string,"load_type_snapshot"?: Database["public"]['Enums']["load_type"],"notes"?: string | null,"position"?: number,"revision"?: number,"session_id"?: string,"target_reps_max"?: number | null,"target_reps_min"?: number | null,"target_sets"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_exercises_session_id_user_id_fkey"
      columns: ["session_id","user_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"weight_entries": {
                  Row: {
                    "created_at": string,"id": string,"measured_on": string,"note": string | null,"updated_at": string,"user_id": string,"weight_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"measured_on": string,"note"?: string | null,"updated_at"?: string,"user_id"?: string,"weight_kg": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"measured_on"?: string,"note"?: string | null,"updated_at"?: string,"user_id"?: string,"weight_kg"?: number
                  }
                  Relationships: [
                    
                  ]
                },"workout_sessions": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"id": string,"name": string | null,"notes": string | null,"revision": number,"routine_id": string | null,"routine_name_snapshot": string | null,"started_at": string,"status": Database["public"]['Enums']["workout_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"id": string,"name"?: string | null,"notes"?: string | null,"revision"?: number,"routine_id"?: string | null,"routine_name_snapshot"?: string | null,"started_at"?: string,"status"?: Database["public"]['Enums']["workout_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"name"?: string | null,"notes"?: string | null,"revision"?: number,"routine_id"?: string | null,"routine_name_snapshot"?: string | null,"started_at"?: string,"status"?: Database["public"]['Enums']["workout_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_sessions_routine_id_fkey"
      columns: ["routine_id"]
isOneToOne: false
      referencedRelation: "routines"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_sets": {
                  Row: {
                    "completed": boolean,"created_at": string,"id": string,"is_warmup": boolean,"notes": string | null,"position": number,"reps": number | null,"revision": number,"session_exercise_id": string,"updated_at": string,"user_id": string,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "completed"?: boolean,"created_at"?: string,"id": string,"is_warmup"?: boolean,"notes"?: string | null,"position": number,"reps"?: number | null,"revision"?: number,"session_exercise_id": string,"updated_at"?: string,"user_id"?: string,"weight_kg"?: number | null
                  }
                  Update: {
                    "completed"?: boolean,"created_at"?: string,"id"?: string,"is_warmup"?: boolean,"notes"?: string | null,"position"?: number,"reps"?: number | null,"revision"?: number,"session_exercise_id"?: string,"updated_at"?: string,"user_id"?: string,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_sets_session_exercise_id_user_id_fkey"
      columns: ["session_exercise_id","user_id"]
isOneToOne: false
      referencedRelation: "session_exercises"
      referencedColumns: ["id","user_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"save_routine":
{ Args: { "p_id": string,"p_items": Json,"p_name": string,"p_notes": string }; Returns: string
                           },
"sync_workout":
{ Args: { "p_ops": Json }; Returns: Json
                           }
          }
          Enums: {
            "activity_level": "sedentary"|"lightly_active"|"moderately_active"|"very_active"|"extra_active","equipment_type": "barbell"|"dumbbell"|"machine"|"cable"|"bodyweight"|"kettlebell"|"band"|"smith_machine"|"ez_bar"|"trap_bar"|"other","estimate_sex": "male"|"female","load_type": "external"|"bodyweight"|"assisted","meal_category": "breakfast"|"lunch"|"dinner"|"snack","measurement_site": "neck"|"shoulders"|"chest"|"waist"|"hips"|"left_arm"|"right_arm"|"left_forearm"|"right_forearm"|"left_thigh"|"right_thigh"|"left_calf"|"right_calf","muscle_group": "chest"|"upper_back"|"lats"|"lower_back"|"traps"|"shoulders"|"biceps"|"triceps"|"forearms"|"abs"|"obliques"|"quads"|"hamstrings"|"glutes"|"calves"|"adductors"|"abductors"|"neck"|"full_body"|"cardio","unit_system": "metric"|"imperial","workout_status": "in_progress"|"completed"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "activity_level": ["sedentary", "lightly_active", "moderately_active", "very_active", "extra_active"],"equipment_type": ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band", "smith_machine", "ez_bar", "trap_bar", "other"],"estimate_sex": ["male", "female"],"load_type": ["external", "bodyweight", "assisted"],"meal_category": ["breakfast", "lunch", "dinner", "snack"],"measurement_site": ["neck", "shoulders", "chest", "waist", "hips", "left_arm", "right_arm", "left_forearm", "right_forearm", "left_thigh", "right_thigh", "left_calf", "right_calf"],"muscle_group": ["chest", "upper_back", "lats", "lower_back", "traps", "shoulders", "biceps", "triceps", "forearms", "abs", "obliques", "quads", "hamstrings", "glutes", "calves", "adductors", "abductors", "neck", "full_body", "cardio"],"unit_system": ["metric", "imperial"],"workout_status": ["in_progress", "completed"]
          }
        }
} as const
