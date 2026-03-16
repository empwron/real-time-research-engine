import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
const c = {apiKey:"AIzaSyBmXlWshFJjSDx6QVOBHjW8PxXHik5g1AU",authDomain:"realtimeresearchengine.firebaseapp.com",databaseURL:"https://realtimeresearchengine-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"realtimeresearchengine",storageBucket:"realtimeresearchengine.firebasestorage.app",messagingSenderId:"1405907967",appId:"1:1405907967:web:3e1120c155c7e19902edca"}
const app = initializeApp(c)
export const auth = getAuth(app)
export const db = getDatabase(app)
