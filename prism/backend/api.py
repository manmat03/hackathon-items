from fastapi import FastAPI

from utils import get_eval_from_description, load_current_skills, update_user_skill

app = FastAPI()


@app.get("/skills")
def get_user_skills():
    return load_current_skills()


@app.get("/eval")
def eval_description(work_description: str):
    get_eval_from_description(work_description)


@app.patch("/skills")
def update_skill(skill_name: str, skill_level: int):
    update_user_skill(skill_name, skill_level)
