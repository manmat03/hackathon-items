# Design

expected folders:
- frontend
- backend

## General design notes

This is running LOCALLY. Do not worry about user accounts, nor session persistance. 

## Frontend design

### Technical Choices
- Use SolidJS (not SolidStart) for the frontend
- Use TypeScript, not vanilla JS

### UI Notes

For now, have it be a screen with a task board selecter on the left, and a main task view in the middle.

Each task can be dragged around and interacted with. Display their name, and expected date. 
If the due date for the task is within 2 days, color it yellow. If the due date for the task has already passed,
color it red. If the due date is further out than 2 days, color it green.

Each task can be double-clicked into, which opens a detailed view of the task's description, immediate parent task,
and immediate child tasks.

Each task can be OPTIONALLY directed to flow to another task.

Prepopulate this board with a few sample tasks.

Add a button to the task board list to import a task list from Microsoft Planner. Planner exports a task board as an 
`.xlsx`, see the sample version in this repo `Tasks.xlsx`.

### Technical Details

Try and pull a list of task boards from the endpoint `/boards`

For each board, try and pull a list of tasks from the endpoint `[boardid]/tasks`

Submit new tasks by PUT to `[boardid]/tasks`

Each task has these required fields, make this into a class:
```
taskId - a UUID for a given task
taskName - a name for a task
taskDescription - a description for a task
expectedDate - a date of when a task is expected to be done
certainty - LOW, MEDIUM, or HIGH certainty of a task being complete on time
parents - list of UUID of parent tasks, can be empty list
children - list of UUID of children tasks, can be an empty list
```
