import pandas as pd
import streamlit as st

from utils import Skill, SkillName, load_current_skills

st.title("Prism")

skills_loading_text = st.text("Loading current info...")
current_skills: list[Skill] = load_current_skills()
skills_df = pd.DataFrame(
    {
        "Skill Name": [skill.name for skill in current_skills],
        "Level": [skill.score for skill in current_skills],
    }
)
skills_loading_text.text("Loading current info...done!")
st.write(skills_df)
