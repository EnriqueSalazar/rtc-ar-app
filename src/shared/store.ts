import { configureStore, ThunkAction, Action } from "@reduxjs/toolkit";
import roomReducer from "../index/store/roomSlice";

export const store = configureStore({
  reducer: {
    counter: roomReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppThunk = ThunkAction<void, RootState, unknown, Action<string>>;
