import { createBrowserRouter } from 'react-router-dom'
import Layout from './Layout'
import About from './Components/About/About'
import Theory from './Components/Theory/Theory'
import Simulation from './Components/Simulation/Simulation'


const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
        {
            index: true,
            element: <About/>
        },
        {
            path: 'theory',
            element: <Theory/>
        },
        {
          path: 'simulation',
          element: <Simulation/>
        }
    ]
  },
  {
    path: '*',
    element: <div style={{ padding: '2rem', color: '#FFF' }}>Ошибка 404: Страница не найдена</div>
  }
])

export default router