import os
import sqlite3
import tempfile
import unittest

from database import Database
from domain import CardioExercise, HocVien, StrengthExercise


class DomainTests(unittest.TestCase):
    def test_student_metrics_use_mifflin_st_jeor(self):
        student = HocVien("HV", "Test", "test@example.com", 170, 70, 25, True, 1.55, "Tăng cơ")
        self.assertAlmostEqual(student.tinhBMI(), 70 / 1.7**2)
        self.assertEqual(student.tinhBMR(), 1642.5)
        self.assertAlmostEqual(student.tinhTDEE(), 1642.5 * 1.55)

    def test_activity_factor_is_validated(self):
        with self.assertRaises(ValueError):
            HocVien("HV", "Test", "test@example.com", 170, 70, 25, True, 1.8, "Duy trì")

    def test_exercise_calculations_are_polymorphic(self):
        cardio = CardioExercise("Chạy bộ", 30, 5, 140)
        strength = StrengthExercise("Hít đất", 20, 3, 12, 30)
        self.assertGreater(cardio.calculateCalories(), 0)
        self.assertGreater(strength.calculateCalories(), 0)
        self.assertNotEqual(cardio.calculateCalories(), strength.calculateCalories())


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        handle, self.path = tempfile.mkstemp(suffix=".sqlite3")
        os.close(handle)
        self.database = Database(self.path)

    def tearDown(self):
        os.remove(self.path)

    def test_seed_and_daily_meals_are_consistent(self):
        dashboard = self.database.dashboard("HV001")
        self.assertEqual(len(self.database.list_foods()), 6)
        self.assertEqual(len(self.database.list_exercises()), 4)
        self.assertEqual(len(dashboard["meals"]), 3)
        self.assertGreater(dashboard["todayCalories"], 0)
        self.assertGreater(dashboard["macros"]["protein"], 0)

    def test_meal_log_updates_daily_total_and_blocks_duplicate_food(self):
        food = next(item for item in self.database.list_foods() if item["TenMon"] == "Phở bò")
        before = self.database.dashboard("HV001")["todayCalories"]
        self.database.add_meal("HV001", food["MaMon"], 100, "Phụ")
        self.assertGreater(self.database.dashboard("HV001")["todayCalories"], before)
        with self.assertRaises(sqlite3.IntegrityError):
            self.database.add_meal("HV001", food["MaMon"], 100, "Phụ")

    def test_plan_is_assigned_with_details(self):
        plan_id = self.database.create_plan("PT001", "HV002", "Tuần mới", [{"exercise_id": 1, "day": 2, "minutes": 25}])
        plan = self.database.plans("HV002")[0]
        self.assertEqual(plan["id"], plan_id)
        self.assertEqual(plan["items"][0]["minutes"], 25)


if __name__ == "__main__":
    unittest.main()