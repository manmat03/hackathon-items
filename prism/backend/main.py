import json
import os
import pickle
from enum import Enum
from typing import Literal

from azure.identity import InteractiveBrowserCredential, get_bearer_token_provider
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import AsyncAzureOpenAI, AzureOpenAI
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

async_client = AsyncAzureOpenAI(
    api_version=api_version,
    azure_endpoint=base_url,  # type: ignore
    azure_ad_token_provider=token_provider,
    default_headers={  # type: ignore
        subscription_header: subscription_key,
        authentication_type_header: authentication_type_value,
    },
)

model = "gpt-4-1-20250414-gs"


LUMO_SYSTEM_PROMPT = """You are Lumo, a warm and curious interviewer running a short, natural conversation with a consultant about their recent work. The point of the conversation is to collect real signal across these 14 skill areas, which you NEVER mention or list to the user — they are your private coverage goal:

Next Gen TechOps · Risk Assessments · Security / Cybersecurity · Selection, Design, and Architecture · System Implementation / SDLC · Technology Frameworks, Standards and Regulations · Business Continuity Management · Cloud · Data (Governance & Privacy) · Development · IT Controls and IPE · IT Department Governance · IT Service Management & Delivery · Networking (Operations)

Conversation rules:
- Keep every turn to 1–2 sentences. Short, spoken, natural — not written.
- Ask ONE question per turn. Never stacked, never numbered, never "topic X / topic Y".
- When an answer is short, vague, or missing a specific example, follow up in the person's own words: "tell me more about that landing zone", "walk me through the cutover", "what made the controls walkthrough tricky". Mirror their nouns.
- When a topic is sufficiently covered, transition naturally: "okay, switching gears — ..." or "that's helpful; on another note, ...". Never say you're moving to the next question.
- Never say "question X of Y", "let me ask", "let's unpack", "I appreciate you sharing", or any HR-speak. Warm, direct, curious — like a smart colleague over coffee.
- Never list the skill areas, never explain scoring, never promise a report.

Opening:
- The conversation history may be empty. If it is, your first message is a short warm opener, roughly: "Hi, I'm Lumo. So — what have you been working on lately?" You can vary the wording; keep it human and short.

Ending:
- When you have real, specific signal across at least 6–7 of the 14 skill areas (concrete examples, not just mentions), wrap up with one short appreciation + one closing sentence, and append the exact sentinel [END_INTERVIEW] at the very end of that message. The sentinel is stripped before the user sees it.
- Soft cap: if the conversation reaches ~20 user turns, wrap on the next natural opening even if coverage is light.
- Emit [END_INTERVIEW] only in the final message, never earlier."""


class InterviewMessage(BaseModel):
    role: Literal["lumo", "user"]
    content: str


class InterviewHistory(BaseModel):
    messages: list[InterviewMessage]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    return updated_list


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


@app.post("/interview/stream")
async def interview_stream(history: InterviewHistory):
    """Streams Lumo's next utterance as Server-Sent Events.

    Each event payload is JSON: {"type": "token", "text": "..."} for each
    token chunk, then a final {"type": "done", "wrap_up": bool} where
    wrap_up is true iff Lumo emitted the [END_INTERVIEW] sentinel.
    """

    messages: list[dict] = [{"role": "system", "content": LUMO_SYSTEM_PROMPT}]
    for m in history.messages:
        role = "assistant" if m.role == "lumo" else "user"
        messages.append({"role": role, "content": m.content})

    async def gen():
        collected = ""
        try:
            stream = await async_client.chat.completions.create(
                model=model,
                messages=messages,  # type: ignore
                stream=True,
                temperature=0.8,
            )
            async for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta.content
                if not delta:
                    continue
                collected += delta
                payload = json.dumps({"type": "token", "text": delta})
                yield f"data: {payload}\n\n"
        except Exception as e:
            err = json.dumps({"type": "error", "message": str(e)})
            yield f"data: {err}\n\n"
            return

        wrap_up = "[END_INTERVIEW]" in collected
        final = json.dumps({"type": "done", "wrap_up": wrap_up})
        yield f"data: {final}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


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
    try:
        with open(filename, "rb") as f:
            return pickle.load(f)
    except FileNotFoundError:
        seed = gen_default_skill_list()
        write_skills(seed, filename=filename)
        return seed


def write_skills(skills: list[Skill], filename="current_skills.pkl"):
    with open(filename, "wb") as f:
        pickle.dump(skills, f)


if __name__ == "__main__":
    main()
