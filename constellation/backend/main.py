import datetime
import os
import uuid
from datetime import date
from enum import Enum

import polars as pl
from agents import (
    Agent,
    OpenAIChatCompletionsModel,
    Runner,
    function_tool,
    set_tracing_disabled,
)
from azure.identity import InteractiveBrowserCredential, get_bearer_token_provider
from dotenv import load_dotenv
from fastapi import FastAPI
from openai import AsyncAzureOpenAI
from pydantic import BaseModel

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


set_tracing_disabled(disabled=True)
client = AsyncAzureOpenAI(
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


class Certainty(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


type UUID = str


class Task(BaseModel):
    task_id: UUID
    task_name: str
    task_description: str
    expected_date: date
    certainty: Certainty
    parents: list[UUID]  # uuid of tasks
    children: list[UUID]  # uuid of tastks


class Board(BaseModel):
    board_id: UUID
    board_name: str
    board_tasks: list[Task]


@app.get("/boards")
def get_boards():
    try:
        return [
            {"boardId": board.board_id, "boardName": board.board_name}
            for board in read_boards_from_db()
        ]
    except Exception as e:
        print(f"couldn't read boards! {e}")
        return []


@app.get("/{board_id}/tasks")
def get_tasks_from_board(board_id: UUID):
    try:
        for board in read_boards_from_db():
            if board.board_id == board_id:
                return board.board_tasks
    except Exception as e:
        print(f"couldn't read boards! {e}")
        return []


@app.put("/boards")
def put_board(new_board: Board):
    try:
        all_boards = read_boards_from_db()
        for board in all_boards:
            if new_board.board_id == board.board_id:
                board.board_tasks.extend(new_board.board_tasks)
                board.board_tasks = list(set(board.board_tasks))  # filter out dupes
            else:
                all_boards.append(new_board)
        write_boards_to_db(all_boards)
    except Exception as e:
        print(f"error! {e}")


@app.put("/{board_id}/tasks")
def put_task(board_id: UUID, task: Task):
    try:
        all_boards = read_boards_from_db()

        for board in all_boards:
            if board.board_id == board_id:
                board.board_tasks.append(task)
                write_boards_to_db(all_boards)
    except Exception as e:
        print(f"error! {e}")


@app.put("/{board_id}/query")
async def query_natural_language(board_id: UUID, query: str):

    current_board = None
    for board in read_boards_from_db():
        if board.board_id == board_id:
            current_board = board
    if current_board is None:
        print(f"couldn't find board with id: {board_id}")
        raise ValueError()

    @function_tool
    def get_task_names() -> list[str]:
        """Returns a list of all task names in a given project board."""
        return [task.task_name for task in current_board.board_tasks]

    @function_tool
    def get_task_description_by_name(name: str) -> str:
        """Returns a specific task's description by the name"""
        for task in current_board.board_tasks:
            if task.task_name == name:
                return task.task_description
        return "ERR: couldn't find task with that name!"

    @function_tool
    def get_task_children_by_name(name: str) -> list[str]:
        """Returns the names of a task's immediate children."""
        task_names = []
        children_uuids = set()
        for task in current_board.board_tasks:
            if task.task_name == name:
                children_uuids = set(task.children)
        for task in current_board.board_tasks:
            if task.task_id in children_uuids:
                task_names.append(task.task_name)
        return task_names

    @function_tool
    def get_task_parents_by_name(name: str) -> list[str]:
        """Returns the names of a task's immediate parents."""
        task_names = []
        parent_uuids = set()
        for task in current_board.board_tasks:
            if task.task_name == name:
                parent_uuids = set(task.parents)
        for task in current_board.board_tasks:
            if task.task_id in parent_uuids:
                task_names.append(task.task_name)
        return task_names

    agent = Agent(
        name="Project Management Assistant",
        instructions="""Act like an expert Project Manager and answer the user's timeline-specific questions. Questions
        that are too vague, don't relate to the current project, or have an unclear answer should be flagged
        to the user. If the user asks for timeline questions, answer with conservative responses (i.e. if you think
        a task will take a week, tell the user it'll take a week in a half instead.)
        """,
        model=OpenAIChatCompletionsModel(model=model, openai_client=client),
        tools=[
            get_task_names,
            get_task_description_by_name,
            get_task_children_by_name,
            get_task_parents_by_name,
        ],
    )
    result = await Runner.run(agent, query)
    print(result.final_output)
    return result.final_output


def gen_uuid() -> str:
    return str(uuid.uuid4())


def main():
    print("Hello from backend!")


def boards_to_df(boards: list[Board]) -> pl.DataFrame:
    ids = [board.board_id for board in boards]

    return pl.DataFrame({"board_id": ids, "board": boards})


def read_boards_from_db():
    board_info = pl.DataFrame.deserialize(
        "tables/boards",
    )

    boards = [
        Board(**board["board"]) for board in board_info.select("board").to_dicts()
    ]

    print(boards)
    return boards


def write_boards_to_db(boards: list[Board]):
    boards_df = boards_to_df(boards)
    boards_df.serialize("tables/boards")


def read_dummy_table():
    read_boards_from_db()


def write_dummy_table():
    task = Task(
        task_id=gen_uuid(),
        task_name="Finish hackathon!",
        task_description="",
        expected_date=datetime.datetime(2026, 10, 2, tzinfo=datetime.UTC),
        certainty=Certainty.LOW,
        parents=[],
        children=[],
    )
    board = Board(board_id=gen_uuid(), board_name="test_board", board_tasks=[task])
    empty_board = Board(board_id=gen_uuid(), board_name="test_board", board_tasks=[])
    boards = [board, empty_board]

    write_boards_to_db(boards)


if __name__ == "__main__":
    write_dummy_table()
    read_dummy_table()
