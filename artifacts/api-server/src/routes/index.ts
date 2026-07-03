import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import usersRouter from "./users";
import artistsRouter from "./artists";
import albumsRouter from "./albums";
import songsRouter from "./songs";
import playlistsRouter from "./playlists";
import featuredRouter from "./featured";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(usersRouter);
router.use(artistsRouter);
router.use(albumsRouter);
router.use(songsRouter);
router.use(playlistsRouter);
router.use(featuredRouter);

export default router;
