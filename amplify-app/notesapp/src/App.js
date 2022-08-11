//useReducer : 현재 상태를 저장하기 위한 hook
import React, { useEffect, useReducer } from 'react' 
import { API, graphqlOperation } from 'aws-amplify'
import { v4 as uuid } from 'uuid'
import { List, Input, Button } from 'antd'
import 'antd/dist/antd.min.css'
import { listNotes } from './graphql/queries'
import { 
  createNote as CreateNote, 
  updateNote as UpdateNote,
  deleteNote as DeleteNote
} from './graphql/mutations'
import { onCreateNote } from './graphql/subscriptions'
const CLIENT_ID = uuid();

const initialState = { //어플리케이션의 초기 상태를 지정한다
  notes: [],
  loading: true,
  error: false,
  form: {name: '', description: ''}
};

function reducer(state, action) { //상태 변화가 있을 때, 어떤 상태값으로 바꿀지를 정의한다.
  switch(action.type) {
    case 'SET_NOTES' : //노트 리스트 불러오기
      return { ...state, notes: action.notes, loading: false };
    case 'ADD_NOTE' : //새 노트 추가
      return { ...state, notes: [action.note, ...state.notes] }; 
    case 'RESET_FORM' : //사용자 입력 필드를 다시 깨끗하게 만든다
      return { ...state, form: initialState.form };
    case 'SET_INPUT' : //사용자가 입력할 때 form 상태 변경
      return { ...state, form: {...state.form, [action.name] : action.value}};
    case 'ERROR' :
      return { ...state, loading: false, error: true };
    default:
      return state;
   }
}

function App() {
  //dispatch를 호출하면, dispatch의 인수를 reducer가 평가해서 state에 반영한다.
  const [state, dispatch] = useReducer(reducer, initialState);
  const styles = {
    container: { padding: 20 },
    input: { marginBottom: 10 },
    item: { textAlign: 'left' },
    p: { color: '#1890ff',  }
  }

  /////////////////////////////
  //TODO List의 CRUD 관련 함수
  /////////////////////////////
  async function fetchNotes() {
    try {
      const notesData = await API.graphql({
        query: listNotes
      })
      dispatch({ type: 'SET_NOTES', notes: notesData.data.listNotes.items });
    } catch (e) {
      console.error(e);
      dispatch({ type: 'ERROR' });
    }
  };

  async function createNote() {
    const { form } = state;
    if (!form.name || !form.description) {
      return alert('please enter name and description');
    }
    const note = { ...form, clientId: CLIENT_ID, completed: false, id: uuid() };

    //API 호출 전에 UI를 먼저 업데이트해서 사용자가 빠른 감을 느끼게 만든다.
    dispatch({ type: 'ADD_NOTE', note });
    dispatch({ type: 'RESET_FORM' });

    try {
      await API.graphql({
        query: CreateNote,
        variables: { input: note }
      })
      console.log('successfully created note!');
    } catch (error) {
      console.error(error);
    }
  }

  async function deleteNote({ id }) {
    const index = state.notes.findIndex(note => note.id === id); //해당 리스트의 id의 index를 찾는다
    const notes = [
      ...state.notes.slice(0, index),
      ...state.notes.slice(index + 1)
    ]
    dispatch({ type: 'SET_NOTES', notes });
    try {
      await API.graphql({
        query: DeleteNote,
        variables: { input: { id } }
      })
      console.log('successfully deleted note!');
    } catch (error) {
      console.error(error);
    }
  }

  async function updateNote(note) {
    const index = state.notes.findIndex(n => n.id === note.id)
    const notes = [...state.notes];
    notes[index].completed = !note.completed;
    dispatch({ type: 'SET_NOTES', notes });
    try {
      await API.graphql({
        query: UpdateNote,
        variables: { input: {id: note.id, completed: notes[index].completed }}
      })
      console.log('note updated');
    } catch (error) {
      console.error(error);
    }
  }

  //이벤트 처리 함수
  function onChange(event) {
    dispatch({ type: 'SET_INPUT', name: event.target.name, value: event.target.value });
  }

  //DOM 생성 함수
  function renderItem(item) {
    return (
      <List.Item 
        style={styles.item}
        actions={[
          <p style={styles.p} onClick={() => deleteNote(item)}>Delete</p>,
          <p style={styles.p} onClick={() => updateNote(item)}>
            {item.completed ? 'Completed' : 'To be Done'}
          </p>
        ]}
      >
        <List.Item.Meta
          title={item.name}
          description={item.description}
        />
      </List.Item>
    )
  }

  useEffect(() => { //웹에서 자동으로, 혹은 특정 시점에 무언가가 일어나도록 한다.
    fetchNotes();
   // console.log('client_id : ' + CLIENT_ID);
    const subscription = API.graphql({
      query: onCreateNote
    }).subscribe({
      next: noteData => {
        const note = noteData.value.data.onCreateNote
        if (CLIENT_ID === note.clientId) return;
        dispatch({ type: 'ADD_NOTE', note });
      }
    })
    return () => subscription.unsubscribe();
  }, []); //두 번째 인자는 해당 값이 변경될 때 호출되는 조건. 비어있으면 마운트 될 때만 첫 번째 인자(함수)호출.


  return (
    <div style={styles.container}>
      <Input
        onChange={onChange}
        value={state.form.name}
        placeholder={"Note Name"}
        name="name"
        style={styles.input}
      />
      <Input
        onChange={onChange}
        value={state.form.description}
        placeholder={"Note Description"}
        name="description"
        style={styles.input}
      />
      <Button
        onClick={createNote}
        type="primary"
      >Create Note</Button>
      <List
        loading={state.loading}
        dataSource={state.notes}
        renderItem={renderItem}
      />
    </div>
  );
}

export default App;
