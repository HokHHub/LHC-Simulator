import s from './Container3.module.css'
export default function Container(props){
    return(
        <>
            <div className={s.container}>
                {props.children}
            </div>
        </>
    )
}