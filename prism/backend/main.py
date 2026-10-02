import os
import pickle
from enum import Enum

from azure.identity import InteractiveBrowserCredential, get_bearer_token_provider
from dotenv import load_dotenv
from fastapi import FastAPI
from openai import AzureOpenAI
from pydantic import BaseModel


class SkillName(str, Enum):
    NEXT_GEN_TECHOPS = "Next Gen TechOps"
    RISK_ASSESSMENTS = "Risk Assessments"
    SECURITY_CYBERSECURITY = "Security / Cybersecurity"
    SELECTION_DESIGN_AND_ARCHITECTURE = "Selection, Design, and Architecture"
    SYSTEM_IMPLEMENTATION_SDLC = "System Implementation / SDLC"
    TECHNOLOGY_FRAMEWORKS_STANDARDS_AND_REGULATIONS = (
        "Technology Frameworks, Standards and Regulations"
    )
    BUSINESS_CONTINUITY_MANAGEMENT = "Business Continuity Management"
    CLOUD = "Cloud"
    DATA_GOVERNANCE_AND_PRIVACY = "Data (Governance & Privacy)"
    DEVELOPMENT = "Development"
    IT_CONTROLS_AND_IPE = "IT Controls and IPE"
    IT_DEPARTMENT_GOVERNANCE = "IT Department Governance"
    IT_SERVICE_MANAGEMENT_AND_DELIVERY = "IT Service Management & Delivery"
    NETWORKING_OPERATIONS = "Networking (Operations)"


class Skill(BaseModel):
    name: SkillName
    score: int  # cap this from 0-5


class SkillList(BaseModel):
    skills: list[Skill]


load_dotenv()

base_url = os.getenv("BASE_URL")
api_version = os.getenv("API_VERSION")
subscription_header = os.getenv("SUBSCRIPTION_HEADER")
subscription_key = os.getenv("SUBSCRIPTION_KEY")
authentication_type_header = os.getenv("AUTHENTICATION_TYPE_HEADER")
authentication_type_value = os.getenv("AUTHENTICATION_TYPE_VALUE")
token_scope = os.getenv("TOKEN_SCOPE")
tenant_id = os.getenv("TENANT_ID")
client_id = os.getenv("CLIENT_ID")


creds = InteractiveBrowserCredential(tenant_id=tenant_id, client_id=client_id)
token_provider = get_bearer_token_provider(creds, token_scope)  # type: ignore


client = AzureOpenAI(
    api_version=api_version,
    azure_endpoint=base_url,  # type: ignore
    azure_ad_token_provider=token_provider,
    default_headers={  # type: ignore
        subscription_header: subscription_key,
        authentication_type_header: authentication_type_value,
    },
)

model = "gpt-4-1-20250414-gs"

app = FastAPI()


def main():
    skills = gen_default_skill_list()
    write_skills(skills)
    written_skills = load_current_skills()
    assert skills == written_skills


@app.get("/skills")
def get_user_skills():
    return load_current_skills()


@app.get("/eval")
def eval_description(work_description: str):
    res = client.responses.parse(
        instructions="""Using the user's work experience,
        fill out the given skill list with an estimated skill level.
        0 = No experience,
        1 = Learning only,
        2 = Extremely Basic Real-world experience,
        3 = Basic Real-world experience,
        4 = Intermediate Real-world experience,
        5 = expert-level Real-world experience.""",
        input=work_description,
        text_format=SkillList,
    )
    updated_list = res.output_parsed
    if updated_list is None:
        raise ValueError()
    write_skills(updated_list.skills)


def update_user_skill(skill_name: str, skill_level: int):
    skills = load_current_skills()

    if skill_name not in [skill.name for skill in skills]:
        raise ValueError()

    for skill in skills:
        if skill.name == skill_name:
            if skill.level >= skill_level:
                continue
            skill.level = skill_level
    write_skills(skills)


@app.patch("/skills")
def update_skill(skill_name: str, skill_level: int):
    update_user_skill(skill_name, skill_level)


def gen_default_skill_list() -> list[Skill]:
    skills = [
        Skill(name=SkillName.NEXT_GEN_TECHOPS, score=0),
        Skill(name=SkillName.RISK_ASSESSMENTS, score=0),
        Skill(name=SkillName.SECURITY_CYBERSECURITY, score=0),
        Skill(name=SkillName.SELECTION_DESIGN_AND_ARCHITECTURE, score=0),
        Skill(name=SkillName.SYSTEM_IMPLEMENTATION_SDLC, score=0),
        Skill(name=SkillName.TECHNOLOGY_FRAMEWORKS_STANDARDS_AND_REGULATIONS, score=0),
        Skill(name=SkillName.BUSINESS_CONTINUITY_MANAGEMENT, score=0),
        Skill(name=SkillName.CLOUD, score=0),
        Skill(name=SkillName.DATA_GOVERNANCE_AND_PRIVACY, score=0),
        Skill(name=SkillName.DEVELOPMENT, score=3),
        Skill(name=SkillName.IT_CONTROLS_AND_IPE, score=0),
        Skill(name=SkillName.IT_DEPARTMENT_GOVERNANCE, score=0),
        Skill(name=SkillName.IT_SERVICE_MANAGEMENT_AND_DELIVERY, score=0),
        Skill(name=SkillName.NETWORKING_OPERATIONS, score=0),
    ]
    return skills


def load_current_skills(filename="current_skills.pkl"):
    with open(filename, "rb") as f:
        return pickle.load(f)


def write_skills(skills: list[Skill], filename="current_skills.pkl"):
    with open(filename, "wb") as f:
        pickle.dump(skills, f)


if __name__ == "__main__":
    main()
