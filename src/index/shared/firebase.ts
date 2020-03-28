import firebase from "firebase";

const firebaseApp = firebase.initializeApp({
  apiKey: "AIzaSyCKzNQrlpUqYBD1z7Srj1jaQ7EMfKgwy5s",
  authDomain: "kids-game-project.firebaseapp.com",
  databaseURL: "https://kids-game-project.firebaseio.com",
  projectId: "kids-game-project",
  storageBucket: "kids-game-project.appspot.com",
  messagingSenderId: "760079745155",
  appId: "1:760079745155:web:e5b596cacb4ac3e2325bb6",
  measurementId: "G-Q8CY7EQFRR"
});

const db = firebaseApp.firestore();

export { db };
